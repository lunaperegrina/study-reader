--[[-- ExamWidget: practice exam (simulado) with timer, free navigation,
question palette, end-of-exam grading and per-question review.

Layout (portrait e-readers): top bar (timer | answered count | close),
question + options in the middle (answers are not graded until the end),
bottom bar (previous | palette | next/finish).
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
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local InfoMessage = require("ui/widget/infomessage")
local LineWidget = require("ui/widget/linewidget")
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local _ = require("gettext")

local ExamCore = require("examcore")
local State = require("state")

local ExamWidget = FocusManager:extend{
    course = nil,
    exams = nil,
    session = nil,
    onExit = nil,
}

local PADDING = Size.padding.large

function ExamWidget:init()
    self.dimen = Geom:new{
        w = Device.screen:getWidth(),
        h = Device.screen:getHeight(),
    }
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self.mode = "question"
    self.review_index = 1
    self:_populate()
    self:_startTimer()
end

function ExamWidget:width()
    return self.dimen.w - 2 * PADDING
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

function ExamWidget:_remainingSeconds()
    if not self.session.limitSec or self.session.limitSec <= 0 then
        return nil
    end
    local elapsed = (os.time() - self.session.resumedAt)
        + (self.session.elapsedBeforeResume or 0)
    return math.max(0, self.session.limitSec - elapsed)
end

function ExamWidget:_timerText()
    local remaining = self:_remainingSeconds()
    if not remaining then
        return ExamCore.formatDuration((os.time() - self.session.resumedAt)
            + (self.session.elapsedBeforeResume or 0))
    end
    return ExamCore.formatClock(remaining)
end

function ExamWidget:_startTimer()
    self._timer = function()
        if self._closed then return end
        local remaining = self:_remainingSeconds()
        if remaining == 0 then
            UIManager:show(InfoMessage:new{ text = _("Time is up!"), timeout = 3 })
            self:_finish(true)
            return
        end
        local text = self._timer_label
        if text and remaining then
            local shown = ExamCore.formatClock(remaining)
            if text.text ~= shown then
                pcall(function() text:setText(shown) end)
                UIManager:setDirty(self, "ui")
            end
        end
        UIManager:scheduleIn(30, self._timer)
    end
    UIManager:scheduleIn(30, self._timer)
end

function ExamWidget:_populate()
    self.layout = {}
    local width = self:width()
    local group = VerticalGroup:new{ align = "left" }

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
    local function addButton(text, callback, w)
        local button = Button:new{
            text = text,
            width = w or width,
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
        self:_populateResults(group, addText, addWrapped, addSpan, addButton)
    elseif self.mode == "review" then
        self:_populateReview(group, addText, addWrapped, addSpan, addButton)
    else
        self:_populateQuestion(group, addText, addWrapped, addSpan, addButton)
    end

    local filler = math.max(0, self.dimen.h - group:getSize().h - 3 * PADDING)
    local full_group = VerticalGroup:new{ align = "left" }
    full_group[1] = self:_buildTopBar()
    full_group[2] = VerticalSpan:new{ width = math.max(Size.padding.default, math.floor(filler / 2)) }
    for i = 1, #group do
        full_group[#full_group + 1] = group[i]
    end
    full_group[#full_group + 1] = VerticalSpan:new{ width = filler }

    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = PADDING,
        full_group,
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

function ExamWidget:_buildTopBar()
    local width = self:width()
    local mode_label = self.mode == "results" and _("Results")
        or self.mode == "review"
        and string.format(_("Review %d/%d"), self.review_index, #self.session.questionIds)
        or string.format("%d/%d", self.session.current, #self.session.questionIds)
    local timer_text = self:_timerText()
    local bar = HorizontalGroup:new{
        align = "center",
        TextWidget:new{
            text = timer_text,
            face = Font:getFace("infont", 20),
            max_width = math.floor(width / 3),
        },
        HorizontalSpan:new{ width = math.floor(width / 6) },
        TextWidget:new{
            text = string.format("%s  ·  %s", mode_label,
                string.format(_("answered %d/%d"), self:_answeredCount(),
                    #self.session.questionIds)),
            face = Font:getFace("smallinfofont"),
            max_width = math.floor(width / 2),
        },
    }
    self._timer_label = bar[1]
    local line = LineWidget:new{
        dimen = Geom:new{ w = width, h = Size.line.thick },
        background = Blitbuffer.COLOR_LIGHT_GRAY,
    }
    return VerticalGroup:new{
        align = "center",
        CenterContainer:new{
            dimen = Geom:new{ w = width, h = bar:getSize().h },
            bar,
        },
        line,
    }
end

function ExamWidget:_populateQuestion(group, addText, addWrapped, addSpan, addButton)
    local width = self:width()
    local index = self.session.current
    local id = self.session.questionIds[index]
    local question = self.course.questions[id]
    if not question then
        addText(_("Question not found in bank"), Font:getFace("cfont", 22))
        return
    end
    addWrapped(question.question, Font:getFace("cfont", 24))
    if question.code then
        addSpan(Size.padding.default)
        addWrapped(question.code, Font:getFace("infont", 18))
    end
    addSpan(PADDING)
    local selected = self.session.answers[id] or {}
    local chosen = {}
    for _, oid in ipairs(selected) do
        chosen[oid] = true
    end
    for _, option in ipairs(question.options) do
        local prefix = chosen[option.id]
            and (question.type == "multiple-choice" and "☑ " or "◉ ")
            or "☐ "
        addButton(string.format("%s%s) %s", prefix, option.id, option.text), function()
            self:_toggle(option.id, question)
        end)
        addSpan(Size.padding.small)
    end
    addSpan(Size.padding.default)

    local third = math.floor(width / 3)
    local bottom = HorizontalGroup:new{
        align = "center",
        Button:new{
            text = "‹ " .. _("Prev"),
            width = third,
            enabled = index > 1,
            callback = function() self:_go(index - 1) end,
            show_parent = self,
        },
        HorizontalSpan:new{ width = Size.padding.small },
        Button:new{
            text = "☰",
            width = third - 2 * Size.padding.small,
            callback = function() self:_showPalette() end,
            show_parent = self,
        },
        HorizontalSpan:new{ width = Size.padding.small },
        Button:new{
            text = index < #self.session.questionIds and _("Next") .. " ›"
                or _("Finish") .. " ✓",
            width = third,
            callback = function()
                if index < #self.session.questionIds then
                    self:_go(index + 1)
                else
                    self:_confirmFinish()
                end
            end,
            show_parent = self,
        },
    }
    self.layout[#self.layout + 1] = { bottom[1], bottom[3], bottom[5] }
    group[#group + 1] = CenterContainer:new{
        dimen = Geom:new{ w = width, h = bottom:getSize().h },
        bottom,
    }
end

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
    self:_populate()
end

function ExamWidget:_go(index)
    if index < 1 or index > #self.session.questionIds then
        return
    end
    self.session.current = index
    self:_saveSession()
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
    result.timeUsed = (os.time() - self.session.resumedAt)
        + (self.session.elapsedBeforeResume or 0)
    self.session.status = "done"
    self.session.result = result
    self:_saveSession()
    self.mode = "results"
    self:_populate()
end

function ExamWidget:_populateResults(group, addText, addWrapped, addSpan, addButton)
    local result = self.session.result
    local verdict = result.passed and "✓ " .. _("PASSED") or "✗ " .. _("FAILED")
    addText(verdict, Font:getFace("NotoSans-Bold.ttf", 30), true)
    addSpan(PADDING)
    addWrapped(string.format(_("Score: %d%%  (%d/%d correct)"),
        result.score, result.correct, result.total),
        Font:getFace("cfont", 26))
    addSpan(Size.padding.default)
    addWrapped(string.format(_("Time used: %s · passing score: %d%%"),
        ExamCore.formatDuration(result.timeUsed), ExamCore.PASSING_SCORE),
        Font:getFace("cfont", 22))
    addSpan(PADDING)
    addButton(_("Review answers"), function()
        self.review_index = 1
        self.mode = "review"
        self:_populate()
    end)
    addSpan(Size.padding.default)
    addButton(_("Close"), function() self:onClose() end)
end

function ExamWidget:_populateReview(group, addText, addWrapped, addSpan, addButton)
    local id = self.session.questionIds[self.review_index]
    local question = self.course.questions[id]
    local correct = self.session.result.perQuestion[id]
    local selected = self.session.answers[id] or {}
    addText(string.format(_("Question %d · %s"),
        self.review_index, correct and "✓" or "✗"),
        Font:getFace("NotoSans-Bold.ttf", 24), true)
    addSpan(Size.padding.default)
    if question then
        addWrapped(question.question, Font:getFace("cfont", 22))
        addSpan(Size.padding.default)
        local yours = #selected > 0 and table.concat(selected, ", ") or "—"
        local correct_ids = table.concat(question.correct, ", ")
        addWrapped(string.format("%s: %s\n%s: %s",
            _("Your answer"), yours, _("Correct"), correct_ids),
            Font:getFace("cfont", 22))
        if question.explanation and question.explanation ~= "" then
            addSpan(Size.padding.default)
            addWrapped(question.explanation, Font:getFace("cfont", 22))
        end
    end
    addSpan(PADDING)
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
