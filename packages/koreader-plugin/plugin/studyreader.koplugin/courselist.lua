--[[-- CourseList: home screen listing installed courses (reference e-ink design).

Header (stock TitleBar): bare X top-left, bold centered title, thin gray rule
below. Body: course cards (thin gray border, near-square corners) with bold
title + percentage/chevron on the first row, gray "N aulas" below and a
light-gray progress bar. Footer: gray rule + KOReader's native Menu
pagination (chevron.first/left/right/left Buttons + "Página X de Y" text,
spacers and enable/disable states copied from Menu:updatePageInfo; swipe
east/west/sul like Menu). Card taps are hit-tested at the root (same
workaround as ExamWidget: custom InputContainers don't get taps on the
target device). Long course names wrap; pagination packs measured card
heights greedily.
]]

local Blitbuffer = require("ffi/blitbuffer")
local Button = require("ui/widget/button")
local Device = require("device")
local FocusManager = require("ui/widget/focusmanager")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local LineWidget = require("ui/widget/linewidget")
local ProgressWidget = require("ui/widget/progresswidget")
local Screen = Device.screen
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local TitleBar = require("ui/widget/titlebar")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")

local ok_gr, GestureRange = pcall(require, "ui/widget/gesturerange")
if not ok_gr then
    GestureRange = require("ui/gesturerange")
end

local CourseList = FocusManager:extend{
    courses = nil,
    onExit = nil,
}

local function px(n)
    return math.floor(Screen:scaleBySize(n) + 0.5)
end

local RULE_GRAY = Blitbuffer.COLOR_GRAY_9 or Blitbuffer.COLOR_WEB_GRAY
    or Blitbuffer.COLOR_GRAY
local BORDER_GRAY = Blitbuffer.COLOR_GRAY
local SUB_GRAY = Blitbuffer.COLOR_GRAY_9 or Blitbuffer.COLOR_WEB_GRAY
    or Blitbuffer.COLOR_DARK_GRAY
local CHEV_GRAY = Blitbuffer.COLOR_DARK_GRAY

-- layout tokens; font sizes are RAW (Font:getFace applies DPI scaling)
local L = {
    MARGIN = 37,
    HEADER_GAP = 19,
    CARD_GAP = 16,
    CARD_PAD_H = 12,
    CARD_PAD_TOP = 11,
    CARD_PAD_BOTTOM = 17,
    TITLE_SUB_GAP = 8,
    SUB_BAR_GAP = 13,
    BAR_H = 12,
    RADIUS = 4,
    TITLE_RIGHT_GAP = 14,
    PCT_CHEV_GAP = 7,
    FOOT_RULE_GAP = 21,
    FOOT_BOTTOM = 12,
    FS_HEADER = 22,
    FS_TITLE = 24,
    FS_PCT = 20,
    FS_CHEV = 26,
    FS_SUB = 17,
}

function CourseList:init()
    self.dimen = Geom:new{
        w = Screen:getWidth(),
        h = Screen:getHeight(),
    }
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self.ges_events = {
        TapZone = {
            GestureRange:new{
                ges = "tap",
                range = function() return self.dimen end,
            },
        },
        Swipe = {
            GestureRange:new{
                ges = "swipe",
                range = function() return self.dimen end,
            },
        },
    }
    self.page = 1
    self:_buildPageInfo()
    self:_populate()
end

local function vSpan(h)
    return VerticalSpan:new{ width = px(h) }
end

function CourseList:_buildCard(entry, inner_w)
    local pct = TextWidget:new{
        text = entry.pct and string.format("%d%%", entry.pct) or "—",
        face = Font:getFace("cfont", L.FS_PCT),
        bold = true,
    }
    local chevron = TextWidget:new{
        text = "›",
        face = Font:getFace("cfont", L.FS_CHEV),
        fgcolor = CHEV_GRAY,
    }
    local title = TextBoxWidget:new{
        text = entry.title,
        face = Font:getFace("cfont", L.FS_TITLE),
        width = inner_w - pct:getWidth() - chevron:getWidth()
            - px(L.TITLE_RIGHT_GAP) - px(L.PCT_CHEV_GAP),
        bold = true,
    }
    local sub = TextBoxWidget:new{
        text = entry.lessons and string.format("%d aulas", entry.lessons) or "—",
        face = Font:getFace("cfont", L.FS_SUB),
        width = inner_w,
        fgcolor = SUB_GRAY,
    }
    local bar = ProgressWidget:new{
        width = inner_w,
        height = px(L.BAR_H),
        percentage = (entry.pct or 0) / 100,
        margin_h = 0,
        margin_v = 0,
        bordersize = 0,
        radius = 0,
        bgcolor = Blitbuffer.COLOR_LIGHT_GRAY,
        fillcolor = Blitbuffer.COLOR_BLACK,
    }
    return FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = Size.border.default,
        radius = px(L.RADIUS),
        color = BORDER_GRAY,
        margin = 0,
        padding = px(L.CARD_PAD_H),
        padding_top = px(L.CARD_PAD_TOP),
        padding_bottom = px(L.CARD_PAD_BOTTOM),
        VerticalGroup:new{
            align = "left",
            HorizontalGroup:new{
                title,
                HorizontalSpan:new{ width = px(L.TITLE_RIGHT_GAP) },
                pct,
                HorizontalSpan:new{ width = px(L.PCT_CHEV_GAP) },
                chevron,
            },
            vSpan(L.TITLE_SUB_GAP),
            sub,
            vSpan(L.SUB_BAR_GAP),
            bar,
        },
    }
end

-- pagination controls copied from Menu (chevron icon Buttons + text Button,
-- native spacer and enable/disable states — Menu:updatePageInfo semantics).
-- Buttons persist across pages; the surrounding groups are rebuilt in
-- _populate and only measured at paint, after _updatePageInfo's setText
-- (mutating a measured group leaves stale _offsets and crashes paint).
function CourseList:_buildPageInfo()
    local function chev(icon, cb)
        return Button:new{
            icon = icon,
            callback = cb,
            bordersize = 0,
            show_parent = self,
        }
    end
    self.page_info_first_chev = chev("chevron.first", function() self:onFirstPage() end)
    self.page_info_left_chev = chev("chevron.left", function() self:onPrevPage() end)
    self.page_info_right_chev = chev("chevron.right", function() self:onNextPage() end)
    self.page_info_last_chev = chev("chevron.last", function() self:onLastPage() end)
    self.page_info_spacer = HorizontalSpan:new{
        width = Screen:scaleBySize(32),
    }
    self.page_info_text = Button:new{
        text = "",
        text_font_bold = false,
        bordersize = 0,
        show_parent = self,
    }
end

function CourseList:_updatePageInfo()
    self.page_info_text:setText(string.format("Página %d de %d",
        self.page, self.page_num))
    if self.page_num > 1 then
        self.page_info_text:enable()
    else
        self.page_info_text:disableWithoutDimming()
    end
    self.page_info_first_chev:enableDisable(self.page > 1)
    self.page_info_left_chev:enableDisable(self.page > 1)
    self.page_info_right_chev:enableDisable(self.page < self.page_num)
    self.page_info_last_chev:enableDisable(self.page < self.page_num)
end

function CourseList:_populate()
    self.layout = {}
    local width = self.dimen.w
    local card_w = width - 2 * px(L.MARGIN)
    local inner_w = card_w - 2 * Size.border.default - 2 * px(L.CARD_PAD_H)

    local cards = {}
    for _, entry in ipairs(self.courses) do
        cards[#cards + 1] = self:_buildCard(entry, inner_w)
    end

    local header = TitleBar:new{
        title = "Meus cursos",
        title_face = Font:getFace("smalltfont", L.FS_HEADER),
        width = width,
        align = "center",
        with_bottom_line = true,
        bottom_line_color = RULE_GRAY,
        left_icon = "close",
        left_icon_tap_callback = function() self:onClose() end,
        show_parent = self,
    }
    local header_h = header.dimen.h

    -- footer height is text-independent (Button heights are face-driven):
    -- measure the persistent buttons directly so the card budget is exact
    -- before the page count exists; groups are only measured at paint
    local controls_h = math.max(
        self.page_info_first_chev:getSize().h,
        self.page_info_text:getSize().h)
    local footer_h = Size.line.thick + px(L.FOOT_RULE_GAP)
        + controls_h + px(L.FOOT_BOTTOM)
    -- measure only widgets that are never mutated afterwards: mutating a
    -- VerticalGroup after getSize() leaves stale _offsets and crashes paint
    local available = self.dimen.h - header_h - px(L.HEADER_GAP) - footer_h
    local page_starts = { 1 }
    local used = 0
    for i, card in ipairs(cards) do
        local h = card:getSize().h
        if used > 0 and used + px(L.CARD_GAP) + h > available then
            page_starts[#page_starts + 1] = i
            used = h
        else
            used = used + (used > 0 and px(L.CARD_GAP) + h or h)
        end
    end
    self.page_num = #page_starts
    if self.page > self.page_num then
        self.page = self.page_num
    end

    self:_updatePageInfo()
    local footer = VerticalGroup:new{
        align = "center",
        LineWidget:new{
            dimen = Geom:new{ w = width, h = Size.line.thick },
            background = RULE_GRAY,
        },
        vSpan(L.FOOT_RULE_GAP),
        HorizontalGroup:new{
            self.page_info_first_chev,
            self.page_info_spacer,
            self.page_info_left_chev,
            self.page_info_spacer,
            self.page_info_text,
            self.page_info_spacer,
            self.page_info_right_chev,
            self.page_info_spacer,
            self.page_info_last_chev,
        },
        vSpan(L.FOOT_BOTTOM),
    }

    local stop = self.page < self.page_num and page_starts[self.page + 1] - 1 or #cards
    local children = { header, vSpan(L.HEADER_GAP) }
    local y = header_h + px(L.HEADER_GAP)
    local rects = {}
    for i = page_starts[self.page], stop do
        local card = cards[i]
        if rects[#rects] then
            children[#children + 1] = vSpan(L.CARD_GAP)
            y = y + px(L.CARD_GAP)
        end
        children[#children + 1] = card
        local h = card:getSize().h
        rects[#rects + 1] = {
            course = self.courses[i],
            x = px(L.MARGIN),
            y = y,
            w = card_w,
            h = h,
        }
        y = y + h
    end
    self._card_rects = rects

    children[#children + 1] = VerticalSpan:new{ width = math.max(0, self.dimen.h - y - footer_h) }
    children[#children + 1] = footer

    local group = VerticalGroup:new{ align = "center" }
    for i = 1, #children do
        group[i] = children[i]
    end
    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = 0,
        group,
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

function CourseList:onNextPage()
    local page = self.page < self.page_num and self.page + 1 or 1
    return self:onGotoPage(page)
end

function CourseList:onPrevPage()
    local page = self.page > 1 and self.page - 1 or self.page_num
    return self:onGotoPage(page)
end

function CourseList:onFirstPage()
    return self:onGotoPage(1)
end

function CourseList:onLastPage()
    return self:onGotoPage(self.page_num)
end

function CourseList:onGotoPage(page)
    if page < 1 or page > self.page_num or page == self.page then
        return true
    end
    self.page = page
    self:_populate()
    return true
end

-- Menu's swipe semantics: west/east page turns (cycling), south closes,
-- anything else triggers a full refresh
function CourseList:onSwipe(_, ges_ev)
    local direction = ges_ev and ges_ev.direction
    if direction == "west" then
        self:onNextPage()
    elseif direction == "east" then
        self:onPrevPage()
    elseif direction == "south" then
        self:onClose()
    else
        UIManager:setDirty(nil, "full")
    end
    return true
end

function CourseList:onTapZone(_, ev)
    if self._closed then
        return false
    end
    local pos = ev and ev.pos
    if not pos then return false end
    for _, r in ipairs(self._card_rects or {}) do
        if pos.x >= r.x and pos.x <= r.x + r.w
            and pos.y >= r.y and pos.y <= r.y + r.h then
            r.course.callback()
            return true
        end
    end
    return false
end

function CourseList:onClose()
    if self._closed then return end
    self._closed = true
    UIManager:close(self)
    if self.onExit then self.onExit() end
end

return CourseList
