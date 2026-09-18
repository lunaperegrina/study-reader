--[[-- ReviewWidget: flashcard review with SM-2 grading (Again/Hard/Good/Easy).]]

local Blitbuffer = require("ffi/blitbuffer")
local Button = require("ui/widget/button")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device = require("device")
local FocusManager = require("ui/widget/focusmanager")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local InfoMessage = require("ui/widget/infomessage")
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local _ = require("gettext")

local SRS = require("srs")
local State = require("state")

local ReviewWidget = FocusManager:extend{
    course = nil,
    state = nil,
    onExit = nil,
}

local PADDING = Size.padding.large

function ReviewWidget:init()
    self.due = {}
    for _, card in ipairs(self.course.flashcards) do
        local schedule = self.state.reviews[card.id] or SRS.newCard()
        if SRS.isDue(schedule) then
            self.due[#self.due + 1] = card
        end
    end
    self.index = 1
    self.revealed = false
    self.dimen = Geom:new{
        w = Device.screen:getWidth(),
        h = Device.screen:getHeight(),
    }
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self:_populate()
end

function ReviewWidget:width()
    return self.dimen.w - 2 * PADDING
end

function ReviewWidget:_populate()
    self.layout = {}
    local group = VerticalGroup:new{ align = "left" }
    local width = self:width()

    local function addText(text, face, bold)
        group[#group + 1] = TextWidget:new{
            text = text,
            face = face,
            bold = bold or false,
            max_width = width,
        }
    end
    local function addWrapped(text, face)
        group[#group + 1] = TextBoxWidget:new{
            text = text,
            face = face,
            width = width,
        }
    end
    local function addSpan(h)
        group[#group + 1] = VerticalSpan:new{ width = h }
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

    if #self.due == 0 then
        addText(_("Nothing to review"), Font:getFace("NotoSans-Bold.ttf", 26), true)
        addSpan(PADDING)
        addText(_("No flashcards are due right now. Come back later!"),
            Font:getFace("cfont", 22))
        addSpan(PADDING)
        addButton(_("Close"), function() self:onClose() end)
    else
        local card = self.due[self.index]
        addText(string.format(_("Review %d / %d"), self.index, #self.due),
            Font:getFace("smallinfofont"))
        addSpan(PADDING)
        addWrapped(card.front, Font:getFace("cfont", 26))
        if self.revealed then
            addSpan(PADDING)
            addWrapped(card.back, Font:getFace("cfont", 24))
            addSpan(PADDING)
            for grade_index, label in ipairs(SRS.GRADES) do
                addButton(label, function() self:onGrade(grade_index) end)
                addSpan(Size.padding.small)
            end
        else
            addSpan(PADDING)
            addButton(_("Show answer"), function()
                self.revealed = true
                self:_populate()
            end)
        end
    end

    local filler = math.max(0,
        self.dimen.h - group:getSize().h - 3 * PADDING)
    group[#group + 1] = VerticalSpan:new{ width = filler }

    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = PADDING,
        VerticalGroup:new{
            VerticalSpan:new{ width = PADDING },
            group,
        },
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

function ReviewWidget:onGrade(grade_index)
    local card = self.due[self.index]
    local schedule = self.state.reviews[card.id] or SRS.newCard()
    self.state.reviews[card.id] = SRS.grade(schedule, grade_index)
    State.save(self.course.id, self.state)
    if self.index < #self.due then
        self.index = self.index + 1
        self.revealed = false
        self:_populate()
    else
        UIManager:close(self)
        UIManager:show(InfoMessage:new{
            text = _("Reviews done for now. See you soon!"),
            timeout = 4,
        })
        if self.onExit then self.onExit() end
    end
end

function ReviewWidget:onClose()
    UIManager:close(self)
    if self.onExit then self.onExit() end
end

return ReviewWidget
