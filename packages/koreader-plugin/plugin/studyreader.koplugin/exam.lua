--[[-- ExamWidget: practice exam (simulado) with timer, free navigation,
question palette, end-of-exam grading and per-question review.

Question screen layout (e-ink first, monochrome, no effects):
  header: time-left (stacked over label) | "Pergunta X de Y" | answered count
  thin progress bar
  category (small caps) + question (large, bold, left aligned)
  options as large tappable bordered rows: [checkbox] [letter] [text]
  footer (ruled): ‹ Anterior | ☰ | Próxima › (filled black)
Content that does not fit paginates (Ver mais / Voltar), footer never overlaps.
]]

local Blitbuffer = require("ffi/blitbuffer")
local Button = require("ui/widget/button")
local ButtonDialog = require("ui/widget/buttondialog")
local CenterContainer = require("ui/widget/container/centercontainer")
local ConfirmBox = require("ui/widget/confirmbox")
local Device = require("device")
local FocusManager = require("ui/widget/focusmanager")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/widget/gesturerange")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local InfoMessage = require("ui/widget/infomessage")
local InputContainer = require("ui/widget/container/inputcontainer")
local LeftContainer = require("ui/widget/container/leftcontainer")
local LineWidget = require("ui/widget/linewidget")
local ProgressWidget = require("ui/widget/progresswidget")
local RightContainer = require("ui/widget/container/rightcontainer")
local Screen = Device.screen
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local _ = require("gettext")

local ExamCore = require("examcore")
local State = require("state")

local TapButton, OptionRow

local ExamWidget = FocusManager:extend{
    course = nil,
    exams = nil,
    session = nil,
    onExit = nil,
}

local function px(n)
    return math.floor(Screen:scaleBySize(n) + 0.5)
end

-- layout tokens (e-ink: generous margins, big type, no decoration)
local L = {
    MARGIN = 16,
    HEADER_GAP = 6,
    BAR_H = 6,
    BODY_TOP_GAP = 22,
    CATEGORY_GAP = 6,
    QUESTION_GAP = 18,
    OPT_GAP = 10,
    OPT_PAD_H = 14,
    OPT_PAD_V = 14,
    OPT_CHECK_GAP = 12,
    OPT_LETTER_GAP = 10,
    CHECK_SIZE = 18,
    FOOT_PAD_V = 12,
    FOOT_GAP = 8,
    FS_HEADER = 15,
    FS_TIMER = 20,
    FS_CATEGORY = 13,
    FS_QUESTION = 23,
    FS_OPTION = 19,
    FS_FOOT = 17,
}

local GRAY = Blitbuffer.COLOR_GRAY -- 50% gray, reads as light fill on e-ink
local DARK_GRAY = Blitbuffer.COLOR_DARK_GRAY

function ExamWidget:init()
    self.dimen = Geom:new{
        w = Screen:getWidth(),
        h = Screen:getHeight(),
    }
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self.mode = "question"
    self.review_index = 1
    self._page = 1
    self:_populate()
    self:_startTimer()
end

function ExamWidget:width()
    return self.dimen.w - 2 * px(L.MARGIN)
end

function ExamWidget:_answeredCount()
    local count = 0
    for _, selected in pairs(self.session.answers or {}) do
        if type(selected) == "table" and #selected > 0 then
            count = count + 1
        end
    end
    return count
end

function ExamWidget:_saveSession()
    self.session.elapsed = (os.time() - self.session.resumedAt)
        + (self.session.elapsedBeforeResume or 0)
    State.saveExams(self.course.id, self.exams)
end

function ExamWidget:_elapsedSeconds()
    return (os.time() - self.session.resumedAt)
        + (self.session.elapsedBeforeResume or 0)
end

function ExamWidget:_remainingSeconds()
    if not self.session.limitSec or self.session.limitSec <= 0 then
        return nil
    end
    return math.max(0, self.session.limitSec - self:_elapsedSeconds())
end

function ExamWidget:_startTimer()
    self._timer = function()
        if self._closed or self.session.status ~= "active" then return end
        local remaining = self:_remainingSeconds()
        if remaining == 0 then
            UIManager:show(InfoMessage:new{ text = _("Time is up!"), timeout = 3 })
            self:_finish(true)
            return
        end
        local label = self._timer_label
        if label and remaining then
            local shown = ExamCore.formatClock(remaining)
            if label.text ~= shown then
                pcall(function() label:setText(shown) end)
                UIManager:setDirty(label, function()
                    return "ui", label.dimen
                end)
            end
        end
        UIManager:scheduleIn(30, self._timer)
    end
    UIManager:scheduleIn(30, self._timer)
end

--------------------------------------------------------------------------
-- shared building blocks
--------------------------------------------------------------------------

local function textWidget(text, size, opts)
    opts = opts or {}
    return TextWidget:new{
        text = text,
        face = Font:getFace(opts.face or "cfont", px(size)),
        bold = opts.bold or false,
        fgcolor = opts.fgcolor or Blitbuffer.COLOR_BLACK,
        max_width = opts.max_width,
    }
end

local function boxWidget(text, size, width, opts)
    opts = opts or {}
    return TextBoxWidget:new{
        text = text,
        face = Font:getFace(opts.face or "cfont", px(size)),
        width = width,
        bold = opts.bold or false,
        fgcolor = opts.fgcolor or Blitbuffer.COLOR_BLACK,
        alignment = "left",
        line_height = opts.line_height,
    }
end

local function vSpan(h)
    return VerticalSpan:new{ width = px(h) }
end

-- A tappable framed button-like row built from primitives (stock Button
-- cannot render white-on-black text nor custom inner layout).
TapButton = InputContainer:extend{
    text = "",
    size = L.FS_FOOT,
    bold = true,
    filled = false,
    enabled = true,
    width = nil,
    pad_h = 16,
    pad_v = 12,
    radius = 6,
    callback = nil,
    show_parent = nil,
}

function TapButton:init()
    self.content = self:_build(false)
    self.dimen = self.content:getSize()
    self.ges_events = {
        Tap = GestureRange:new{ ges = "tap", range = self.dimen },
    }
    self[1] = self.content
end

function TapButton:_build(focused)
    local fg = not self.enabled and DARK_GRAY
        or self.filled and Blitbuffer.COLOR_WHITE
        or Blitbuffer.COLOR_BLACK
    local bg = self.filled and Blitbuffer.COLOR_BLACK
        or Blitbuffer.COLOR_WHITE
    local label = TextWidget:new{
        text = self.text,
        face = Font:getFace("cfont", px(self.size)),
        bold = self.bold,
        fgcolor = fg,
        max_width = self.width - 2 * px(self.pad_h),
    }
    return FrameContainer:new{
        background = bg,
        bordersize = 1,
        radius = px(self.radius),
        padding = 0,
        margin = 0,
        CenterContainer:new{
            dimen = Geom:new{
                w = self.width - 2,
                h = label:getSize().h + 2 * px(self.pad_v),
            },
            label,
        },
    }
end

function TapButton:onTap()
    if self.enabled and self.callback then
        self.callback()
    end
    return true
end

function TapButton:onFocus()
    self[1] = self:_build(true)
    return true
end

function TapButton:onUnfocus()
    self[1] = self:_build(false)
    return true
end

--------------------------------------------------------------------------
-- population
--------------------------------------------------------------------------

function ExamWidget:_populate()
    if self.mode == "results" or self.mode == "review" then
        self:_populateLegacy()
        return
    end
    self.layout = {}
    local width = self:width()
    local header = self:_buildHeader(width)
    local content = self:_buildQuestionContent(width)
    local footer = self:_buildFooter(width)
    local available = self.dimen.h - 2 * px(L.MARGIN)
        - header:getSize().h - px(L.HEADER_GAP)
        - footer:getSize().h - px(L.FOOT_PAD_V)

    -- paginate content blocks that do not fit the visible area
    local blocks = content.blocks
    local used = px(L.BODY_TOP_GAP)
    local page, page_count = 1, 1
    local pages = { { start_i = 1 } }
    local more_buttons = {}
    for i, block in ipairs(blocks) do
        local h = block:getSize().h + (blocks[i + 1] and px(L.OPT_GAP) or 0)
        if used + h > available and i > pages[page].start_i then
            page = page + 1
            page_count = page
            pages[page] = { start_i = i }
            used = px(L.BODY_TOP_GAP)
        end
        used = used + h
    end
    self._pages = pages
    self._page_count = page_count
    if self._page > page_count then
        self._page = page_count
    end

    local group = VerticalGroup:new{ align = "left" }
    group[#group + 1] = header
    group[#group + 1] = vSpan(L.BODY_TOP_GAP)

    local range = pages[self._page]
    local stop = self._page < page_count and (pages[self._page + 1].start_i - 1)
        or #blocks
    for i = range.start_i, stop do
        group[#group + 1] = blocks[i]
        if i < stop then
            group[#group + 1] = vSpan(L.OPT_GAP)
        end
    end
    if self._page < page_count then
        group[#group + 1] = vSpan(L.OPT_GAP)
        local more = TapButton:new{
            text = _("Ver mais alternativas") .. " ▾",
            size = L.FS_FOOT,
            bold = false,
            width = width,
            pad_v = 10,
            callback = function()
                self._page = self._page + 1
                self:_populate()
            end,
        }
        self.layout[#self.layout + 1] = { more }
        group[#group + 1] = more
    end

    local used_h = header:getSize().h + px(L.BODY_TOP_GAP)
    for i = range.start_i, stop do
        used_h = used_h + blocks[i]:getSize().h + px(L.OPT_GAP)
    end
    local filler = math.max(0, available - used_h + px(L.OPT_GAP))
    group[#group + 1] = vSpan(filler)
    group[#group + 1] = footer

    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = px(L.MARGIN),
        group,
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

function ExamWidget:_buildHeader(width)
    local timer = self:_timerText()
    self._timer_label = TextWidget:new{
        text = timer,
        face = Font:getFace("infont", px(L.FS_TIMER)),
        max_width = math.floor(width / 3),
    }
    local left = LeftContainer:new{
        dimen = Geom:new{ w = math.floor(width / 3), h = px(L.FS_TIMER + L.FS_HEADER + 8) },
        VerticalGroup:new{
            align = "left",
            self._timer_label,
            textWidget("tempo restante", L.FS_HEADER - 3,
                { fgcolor = DARK_GRAY }),
        },
    }
    local center = CenterContainer:new{
        dimen = Geom:new{ w = math.floor(width / 3), h = px(L.FS_HEADER + 8) },
        VerticalGroup:new{
            align = "center",
            textWidget(string.format("Pergunta %d de %d",
                self.session.current, #self.session.questionIds),
                L.FS_HEADER),
        },
    }
    local right = RightContainer:new{
        dimen = Geom:new{ w = math.floor(width / 3), h = px(L.FS_HEADER + 8) },
        VerticalGroup:new{
            align = "right",
            textWidget(string.format("%d/%d respondidas",
                self:_answeredCount(), #self.session.questionIds),
                L.FS_HEADER),
        },
    }
    local total = #self.session.questionIds
    local progress = self.session.current / total
    local bar = ProgressWidget:new{
        width = width,
        height = px(L.BAR_H),
        percentage = progress,
        radius = px(3),
        bordersize = 1,
        bordercolor = DARK_GRAY,
        bgcolor = Blitbuffer.COLOR_WHITE,
        fillcolor = Blitbuffer.COLOR_DARK_GRAY,
    }
    return VerticalGroup:new{
        align = "center",
        HorizontalGroup:new{
            left,
            center,
            right,
        },
        vSpan(L.HEADER_GAP),
        bar,
    }
end

function ExamWidget:_timerText()
    local remaining = self:_remainingSeconds()
    if not remaining then
        return ExamCore.formatDuration(self:_elapsedSeconds())
    end
    return ExamCore.formatClock(remaining)
end

-- builds the question body as addressable blocks (category, question, options)
function ExamWidget:_buildQuestionContent(width)
    local index = self.session.current
    local id = self.session.questionIds[index]
    local question = self.course.questions[id]
    local blocks = {}

    if not question then
        blocks[1] = boxWidget(_("Question not found in bank"), L.FS_OPTION, width)
        return { blocks = blocks }
    end

    local category = self:_categoryFor(id)
    if category and category ~= "" then
        blocks[#blocks + 1] = LeftContainer:new{
            dimen = Geom:new{ w = width, h = px(L.FS_CATEGORY + 4) },
            textWidget(string.upper(category), L.FS_CATEGORY,
                { fgcolor = DARK_GRAY, bold = true }),
        }
        blocks[#blocks + 1] = vSpan(L.CATEGORY_GAP)
    end

    local question_box = boxWidget(question.question, L.FS_QUESTION, width,
        { bold = true, line_height = 1.25 })
    blocks[#blocks + 1] = question_box
    blocks[#blocks + 1] = vSpan(L.QUESTION_GAP)

    if question.code then
        blocks[#blocks + 1] = boxWidget(question.code, L.FS_OPTION - 3, width,
            { face = "infont" })
        blocks[#blocks + 1] = vSpan(L.QUESTION_GAP)
    end

    local selected = self.session.answers[id] or {}
    local chosen = {}
    for _, oid in ipairs(selected) do
        chosen[oid] = true
    end

    for _, option in ipairs(question.options) do
        local row = self:_buildOptionRow(width, option, chosen[option.id] == true,
            question.type == "multiple-choice")
        self.layout[#self.layout + 1] = { row }
        blocks[#blocks + 1] = row
    end
    return { blocks = blocks }
end

function ExamWidget:_buildOptionRow(width, option, is_selected, is_multi)
    local checkbox = FrameContainer:new{
        background = is_selected and Blitbuffer.COLOR_BLACK
            or Blitbuffer.COLOR_WHITE,
        bordersize = 1,
        radius = px(4),
        padding = 0,
        margin = 0,
        TextWidget:new{
            text = is_selected and "✓" or " ",
            face = Font:getFace("cfont", px(L.CHECK_SIZE)),
            fgcolor = Blitbuffer.COLOR_WHITE,
        },
    }
    local letter = textWidget((option.id):upper(), L.FS_OPTION, { bold = true })
    local text = boxWidget(option.text, L.FS_OPTION,
        width - 2 * px(L.OPT_PAD_H) - px(L.CHECK_SIZE) - px(L.OPT_CHECK_GAP)
        - px(L.FS_OPTION + L.OPT_LETTER_GAP))

    local row = OptionRow:new{
        width = width,
        checkbox = checkbox,
        letter = letter,
        text = text,
        is_selected = is_selected,
        callback = function()
            self:_toggle(option.id, self.course.questions[
                self.session.questionIds[self.session.current]])
        end,
        show_parent = self,
    }
    return row
end

function ExamWidget:_categoryFor(question_id)
    if self._categories then
        return self._categories[question_id]
    end
    self._categories = {}
    for _, module in ipairs(self.course.manifest.modules or {}) do
        for _, lesson in ipairs(module.lessons or {}) do
            for n = 1, 99 do
                self._categories[string.format("%s-q%d", lesson.id, n)] = module.title
            end
        end
    end
    return self._categories[question_id]
end

function ExamWidget:_buildFooter(width)
    local third = math.floor((width - 2 * px(L.FOOT_GAP)) / 3)
    local index = self.session.current
    local total = #self.session.questionIds
    local is_last = index >= total

    local prev = TapButton:new{
        text = "‹ " .. _("Anterior"),
        width = third,
        enabled = index > 1,
        filled = false,
        callback = function() self:_go(index - 1) end,
    }
    local palette = TapButton:new{
        text = "☰",
        width = third,
        bold = true,
        pad_v = 10,
        callback = function() self:_showPalette() end,
    }
    local next = TapButton:new{
        text = is_last and _("Finalizar") .. " ✓" or _("Próxima") .. " ›",
        width = width - 2 * third - 2 * px(L.FOOT_GAP),
        filled = true,
        callback = function()
            if is_last then
                self:_confirmFinish()
            else
                self:_go(index + 1)
            end
        end,
    }
    self.layout[#self.layout + 1] = { prev }
    self.layout[#self.layout + 1] = { palette }
    self.layout[#self.layout + 1] = { next }

    return VerticalGroup:new{
        align = "center",
        LineWidget:new{
            dimen = Geom:new{ w = width, h = Size.line.thick },
            background = DARK_GRAY,
        },
        vSpan(L.FOOT_PAD_V),
        HorizontalGroup:new{
            prev,
            HorizontalSpan:new{ width = px(L.FOOT_GAP) },
            palette,
            HorizontalSpan:new{ width = px(L.FOOT_GAP) },
            next,
        },
    }
end

-- helper: header zones are dimen-sized containers, laid out side by side

--------------------------------------------------------------------------
-- option row widget
--------------------------------------------------------------------------

OptionRow = InputContainer:extend{
    width = nil,
    checkbox = nil,
    letter = nil,
    text = nil,
    is_selected = false,
    callback = nil,
    show_parent = nil,
}

function OptionRow:init()
    local row = FrameContainer:new{
        background = self.is_selected and GRAY or Blitbuffer.COLOR_WHITE,
        bordersize = 1,
        radius = px(6),
        padding = 0,
        margin = 0,
        HorizontalGroup:new{
            align = "top",
            HorizontalSpan:new{ width = px(L.OPT_PAD_H) },
            self:_valign(self.checkbox),
            HorizontalSpan:new{ width = px(L.OPT_CHECK_GAP) },
            self:_valign(self.letter),
            HorizontalSpan:new{ width = px(L.OPT_LETTER_GAP) },
            self.text,
            HorizontalSpan:new{ width = px(L.OPT_PAD_H) },
        },
    }
    self._row = row
    self[1] = FrameContainer:new{
        background = self.is_selected and GRAY or Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        radius = px(6),
        padding = px(L.OPT_PAD_V),
        margin = 0,
        row,
    }
    self.dimen = self[1]:getSize()
    self.ges_events = {
        Tap = GestureRange:new{ ges = "tap", range = self.dimen },
    }
end

function OptionRow:_valign(widget)
    local box_h = self.text:getSize().h
    local w_h = widget:getSize().h
    local pad = math.max(0, math.floor((box_h - w_h) / 2))
    if pad == 0 then
        return widget
    end
    return VerticalGroup:new{
        align = "left",
        VerticalSpan:new{ width = pad },
        widget,
    }
end

function OptionRow:onTap()
    if self.callback then
        self.callback()
    end
    return true
end

function OptionRow:onFocus()
    self._row.background = DARK_GRAY
    return true
end

function OptionRow:onUnfocus()
    self._row.background = self.is_selected and GRAY or Blitbuffer.COLOR_WHITE
    return true
end

--------------------------------------------------------------------------
-- results / review (kept from previous iteration)
--------------------------------------------------------------------------

function ExamWidget:_populateLegacy()
    self.layout = {}
    local width = self:width()
    local group = VerticalGroup:new{ align = "left" }
    local PADDING = px(L.MARGIN)

    local function addText(text, size, opts)
        group[#group + 1] = textWidget(text, size, opts)
    end
    local function addWrapped(text, size, opts)
        opts = opts or {}
        group[#group + 1] = boxWidget(text, size, width, opts)
    end
    local function addSpan(h)
        group[#group + 1] = vSpan(h)
    end
    local function addButton(text, callback)
        local button = Button:new{
            text = text,
            width = width,
            callback = callback,
            show_parent = self,
        }
        self.layout[#self.layout + 1] = { button }
        group[#group + 1] = CenterContainer:new{
            dimen = Geom:new{ w = width, h = button:getSize().h },
            button,
        }
        return button
    end

    if self.mode == "results" then
        local result = self.session.result
        local verdict = result.passed and "✓ " .. _("PASSED") or "✗ " .. _("FAILED")
        addText(verdict, 30, { bold = true })
        addSpan(L.QUESTION_GAP)
        addWrapped(string.format(_("Score: %d%%  (%d/%d correct)"),
            result.score, result.correct, result.total), 26)
        addSpan(10)
        addWrapped(string.format(_("Time used: %s · passing score: %d%%"),
            ExamCore.formatDuration(result.timeUsed), ExamCore.PASSING_SCORE), 20)
        addSpan(L.QUESTION_GAP)
        addButton(_("Review answers"), function()
            self.review_index = 1
            self.mode = "review"
            self:_populate()
        end)
        addSpan(10)
        addButton(_("Close"), function() self:onClose() end)
    else
        local id = self.session.questionIds[self.review_index]
        local question = self.course.questions[id]
        local correct = self.session.result.perQuestion[id]
        local selected = self.session.answers[id] or {}
        addText(string.format(_("Question %d · %s"),
            self.review_index, correct and "✓" or "✗"), 24, { bold = true })
        addSpan(10)
        if question then
            addWrapped(question.question, 22, { bold = true })
            addSpan(10)
            local yours = #selected > 0 and table.concat(selected, ", ") or "—"
            local correct_ids = table.concat(question.correct, ", ")
            addWrapped(string.format("%s: %s\n%s: %s",
                _("Your answer"), yours, _("Correct"), correct_ids), 20)
            if question.explanation and question.explanation ~= "" then
                addSpan(10)
                addWrapped(question.explanation, 20)
            end
        end
        addSpan(L.QUESTION_GAP)
        if self.review_index < #self.session.questionIds then
            addButton(_("Next") .. " ›", function()
                self.review_index = self.review_index + 1
                self:_populate()
            end)
        else
            addButton(_("Back to results"), function()
                self.mode = "results"
                self:_populate()
            end)
        end
    end

    local filler = math.max(0,
        self.dimen.h - group:getSize().h - 3 * PADDING)
    group[#group + 1] = vSpan(filler)

    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = PADDING,
        group,
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

--------------------------------------------------------------------------
-- exam logic (unchanged behavior)
--------------------------------------------------------------------------

function ExamWidget:_toggle(option_id, question)
    local id = self.session.questionIds[self.session.current]
    local selected = self.session.answers[id] or {}
    if question.type == "single-choice" then
        selected = { option_id }
    else
        local found = false
        for i, oid in ipairs(selected) do
            if oid == option_id then
                table.remove(selected, i)
                found = true
                break
            end
        end
        if not found then
            selected[#selected + 1] = option_id
        end
    end
    if #selected > 0 then
        self.session.answers[id] = selected
    else
        self.session.answers[id] = nil
    end
    self:_saveSession()
    self._page = 1
    self:_populate()
end

function ExamWidget:_go(index)
    if index < 1 or index > #self.session.questionIds then
        return
    end
    self.session.current = index
    self:_saveSession()
    self._page = 1
    self:_populate()
end

function ExamWidget:_showPalette()
    local total = #self.session.questionIds
    local rows = {}
    local row = {}
    for i = 1, total do
        local id = self.session.questionIds[i]
        local answered = self.session.answers[id] ~= nil
        local mark = i == self.session.current and "▸"
            or answered and "✓" or ""
        row[#row + 1] = {
            text = string.format("%s%d", mark, i),
            callback = function()
                UIManager:close(self._palette)
                self._page = 1
                self:_go(i)
            end,
        }
        if #row == 5 then
            rows[#rows + 1] = row
            row = {}
        end
    end
    if #row > 0 then
        rows[#rows + 1] = row
    end
    rows[#rows + 1] = {
        {
            text = string.format(_("Finish exam (%d/%d answered)"),
                self:_answeredCount(), total),
            callback = function()
                UIManager:close(self._palette)
                self:_confirmFinish()
            end,
        },
    }
    self._palette = ButtonDialog:new{
        title = _("Go to question"),
        title_align = "center",
        buttons = rows,
    }
    UIManager:show(self._palette)
end

function ExamWidget:_confirmFinish()
    local unanswered = #self.session.questionIds - self:_answeredCount()
    local text = _("Finish the exam and see results?")
    if unanswered > 0 then
        text = text .. "\n" .. string.format(_("(%d unanswered)"), unanswered)
    end
    UIManager:show(ConfirmBox:new{
        text = text,
        ok_text = _("Finish"),
        cancel_text = _("Keep going"),
        ok_callback = function()
            self:_finish(false)
        end,
    })
end

function ExamWidget:_finish(timed_out)
    if self._closed then return end
    local result = ExamCore.grade(self.course.questions,
        self.session.questionIds, self.session.answers)
    result.timedOut = timed_out or nil
    result.finishedAt = os.time()
    result.timeUsed = self:_elapsedSeconds()
    self.session.status = "done"
    self.session.result = result
    self:_saveSession()
    self.mode = "results"
    self:_populate()
end

function ExamWidget:onClose()
    if self._closed then return end
    self._closed = true
    if self.session.status == "active" then
        self:_saveSession()
    end
    UIManager:close(self)
    if self.onExit then self.onExit() end
end

return ExamWidget
