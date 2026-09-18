--[[-- ExamWidget: practice exam (simulado) with timer, free navigation,
question palette, end-of-exam grading and per-question review.

Question screen (e-ink, built exclusively from stock widgets proven on the
target device — custom containers misrender and custom InputContainers do
not get taps there):
  header: [7:00 / tempo restante]  [Pergunta X de Y]  [0/5 respondidas]
  thin progress bar · category (small caps) · question (large, bold, left)
  options: full-width left-aligned Buttons (☐/◉ + letter + text, gray fill
  when selected, generous padding)
  footer (ruled): ‹ Anterior | ☰ | Próxima › / Finalizar ✓
Long content paginates (Ver mais ▾), footer never clipped.
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
local ProgressWidget = require("ui/widget/progresswidget")
local Screen = Device.screen
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
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

local function px(n)
    return math.floor(Screen:scaleBySize(n) + 0.5)
end

local GRAY = Blitbuffer.COLOR_GRAY
local DARK_GRAY = Blitbuffer.COLOR_DARK_GRAY

-- layout tokens
local L = {
    MARGIN = 16,
    HEADER_GAP = 4,
    BAR_H = 6,
    BODY_TOP_GAP = 20,
    CATEGORY_GAP = 6,
    QUESTION_GAP = 16,
    OPT_GAP = 10,
    OPT_PAD_V = 14,
    FOOT_PAD_V = 12,
    FOOT_GAP = 8,
    FS_HEADER = 15,
    FS_SUB = 12,
    FS_TIMER = 20,
    FS_CATEGORY = 13,
    FS_QUESTION = 23,
    FS_OPTION = 19,
    FS_FOOT = 17,
}

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

function ExamWidget:_timerText()
    local remaining = self:_remainingSeconds()
    if not remaining then
        return ExamCore.formatDuration(self:_elapsedSeconds())
    end
    return ExamCore.formatClock(remaining)
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
                UIManager:setDirty(self, "ui")
            end
        end
        UIManager:scheduleIn(30, self._timer)
    end
    UIManager:scheduleIn(30, self._timer)
end

local function textBox(text, size, width, opts)
    opts = opts or {}
    return TextBoxWidget:new{
        text = text,
        face = Font:getFace(opts.face or "cfont", px(size)),
        width = width,
        bold = opts.bold or false,
        fgcolor = opts.fgcolor or Blitbuffer.COLOR_BLACK,
        alignment = opts.alignment or "left",
        line_height = opts.line_height,
    }
end

local function vSpan(h)
    return VerticalSpan:new{ width = px(h) }
end

function ExamWidget:_populate()
    if self.mode == "results" or self.mode == "review" then
        self:_populateLegacy()
        return
    end
    self.layout = {}
    local width = self:width()

    local header = self:_buildHeader(width)
    local footer = self:_buildFooter(width)
    local blocks = self:_buildQuestionBlocks(width)

    -- measure only widgets that are never mutated afterwards: mutating a
    -- VerticalGroup after getSize() leaves stale _offsets and crashes paint
    local available = self.dimen.h - 2 * px(L.MARGIN)
        - header:getSize().h - px(L.BODY_TOP_GAP)
        - footer:getSize().h - px(L.FOOT_PAD_V)

    local gap = px(L.OPT_GAP)
    local pages = { { start_i = 1 } }
    local page_count = 1
    local used = 0
    for i, block in ipairs(blocks) do
        local h = block:getSize().h + gap
        if used > 0 and used + h > available then
            page_count = page_count + 1
            pages[page_count] = { start_i = i }
            used = 0
        end
        used = used + h
    end
    if self._page > page_count then
        self._page = page_count
    end

    local stop = self._page < page_count and (pages[self._page + 1].start_i - 1)
        or #blocks
    local body_h = 0
    local children = { header, vSpan(L.BODY_TOP_GAP) }
    for i = pages[self._page].start_i, stop do
        if body_h > 0 then
            children[#children + 1] = vSpan(L.OPT_GAP)
        end
        children[#children + 1] = blocks[i]
        body_h = body_h + blocks[i]:getSize().h + gap
    end
    if self._page < page_count then
        local more = Button:new{
            text = _("Ver mais alternativas") .. " ▾",
            width = width,
            align = "center",
            padding_v = px(10),
            callback = function()
                self._page = self._page + 1
                self:_populate()
            end,
            show_parent = self,
        }
        self.layout[#self.layout + 1] = { more }
        children[#children + 1] = vSpan(L.OPT_GAP)
        children[#children + 1] = more
        body_h = body_h + gap + more:getSize().h
    end

    local filler = math.max(px(L.FOOT_PAD_V), available - body_h + gap)
    children[#children + 1] = vSpan(filler)
    children[#children + 1] = footer

    local group = VerticalGroup:new{ align = "left" }
    for i = 1, #children do
        group[i] = children[i]
    end

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
    local third = math.floor(width / 3)
    local timer = textBox(self:_timerText(), L.FS_TIMER, third,
        { face = "infont" })
    self._timer_label = timer
    return VerticalGroup:new{
        align = "left",
        HorizontalGroup:new{
            timer,
            textBox(string.format("Pergunta %d de %d",
                self.session.current, #self.session.questionIds),
                L.FS_HEADER, width - 2 * third,
                { alignment = "center" }),
            textBox(string.format("%d/%d respondidas",
                self:_answeredCount(), #self.session.questionIds),
                L.FS_HEADER, third, { alignment = "right" }),
        },
        textBox("tempo restante", L.FS_SUB, third,
            { fgcolor = DARK_GRAY }),
        vSpan(L.HEADER_GAP),
        ProgressWidget:new{
            width = width,
            height = px(L.BAR_H),
            percentage = self.session.current / #self.session.questionIds,
            radius = px(3),
            bordersize = 1,
            bordercolor = DARK_GRAY,
            bgcolor = Blitbuffer.COLOR_WHITE,
            fillcolor = Blitbuffer.COLOR_DARK_GRAY,
        },
    }
end

function ExamWidget:_buildQuestionBlocks(width)
    local index = self.session.current
    local id = self.session.questionIds[index]
    local question = self.course.questions[id]
    local blocks = {}

    if not question then
        blocks[1] = textBox(_("Question not found in bank"), L.FS_OPTION, width)
        return blocks
    end

    local category = self:_categoryFor(id)
    if category and category ~= "" then
        blocks[#blocks + 1] = textBox(string.upper(category), L.FS_CATEGORY,
            width, { bold = true, fgcolor = DARK_GRAY })
        blocks[#blocks + 1] = vSpan(L.CATEGORY_GAP)
    end
    blocks[#blocks + 1] = textBox(question.question, L.FS_QUESTION, width,
        { bold = true, line_height = 1.25 })
    blocks[#blocks + 1] = vSpan(L.QUESTION_GAP)
    if question.code then
        blocks[#blocks + 1] = textBox(question.code, L.FS_OPTION - 3, width,
            { face = "infont" })
        blocks[#blocks + 1] = vSpan(L.QUESTION_GAP)
    end

    local selected = self.session.answers[id] or {}
    local chosen = {}
    for _, oid in ipairs(selected) do
        chosen[oid] = true
    end

    for _, option in ipairs(question.options) do
        local is_selected = chosen[option.id] == true
        local prefix = is_selected
            and (question.type == "multiple-choice" and "☑ " or "◉ ")
            or "☐ "
        local button = Button:new{
            text = string.format("%s%s) %s", prefix, option.id, option.text),
            width = width,
            align = "left",
            padding_v = px(L.OPT_PAD_V),
            bordersize = 1,
            radius = px(6),
            background = is_selected and GRAY or nil,
            callback = function()
                self:_toggle(option.id, question)
            end,
            show_parent = self,
        }
        self.layout[#self.layout + 1] = { button }
        blocks[#blocks + 1] = button
    end
    return blocks
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
    local index = self.session.current
    local total = #self.session.questionIds
    local is_last = index >= total
    local third = math.floor((width - 2 * px(L.FOOT_GAP)) / 3)

    local prev = Button:new{
        text = "‹ " .. _("Anterior"),
        width = third,
        enabled = index > 1,
        callback = function() self:_go(index - 1) end,
        show_parent = self,
    }
    local palette = Button:new{
        text = "☰",
        width = third,
        callback = function() self:_showPalette() end,
        show_parent = self,
    }
    local next = Button:new{
        text = is_last and _("Finalizar") .. " ✓" or _("Próxima") .. " ›",
        width = width - 2 * third - 2 * px(L.FOOT_GAP),
        bordersize = px(2),
        callback = function()
            if is_last then
                self:_confirmFinish()
            else
                self:_go(index + 1)
            end
        end,
        show_parent = self,
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

--------------------------------------------------------------------------
-- results / review (stock widgets, unchanged behavior)
--------------------------------------------------------------------------

function ExamWidget:_populateLegacy()
    self.layout = {}
    local width = self:width()
    local padding = px(L.MARGIN)
    local group = VerticalGroup:new{ align = "left" }

    local function addText(text, size, opts)
        opts = opts or {}
        group[#group + 1] = TextBoxWidget:new{
            text = text,
            face = Font:getFace("cfont", px(size)),
            width = width,
            bold = opts.bold or false,
            fgcolor = opts.fgcolor or Blitbuffer.COLOR_BLACK,
            alignment = "left",
        }
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
        addText(result.passed and "✓ " .. _("PASSED") or "✗ " .. _("FAILED"),
            30, { bold = true })
        group[#group + 1] = vSpan(L.QUESTION_GAP)
        addText(string.format(_("Score: %d%%  (%d/%d correct)"),
            result.score, result.correct, result.total), 26)
        group[#group + 1] = vSpan(10)
        addText(string.format(_("Time used: %s · passing score: %d%%"),
            ExamCore.formatDuration(result.timeUsed),
            ExamCore.PASSING_SCORE), 20)
        group[#group + 1] = vSpan(L.QUESTION_GAP)
        addButton(_("Review answers"), function()
            self.review_index = 1
            self.mode = "review"
            self:_populate()
        end)
        group[#group + 1] = vSpan(10)
        addButton(_("Close"), function() self:onClose() end)
    else
        local id = self.session.questionIds[self.review_index]
        local question = self.course.questions[id]
        local correct = self.session.result.perQuestion[id]
        local selected = self.session.answers[id] or {}
        addText(string.format(_("Question %d · %s"),
            self.review_index, correct and "✓" or "✗"), 24, { bold = true })
        group[#group + 1] = vSpan(10)
        if question then
            addText(question.question, 22, { bold = true })
            group[#group + 1] = vSpan(10)
            local yours = #selected > 0 and table.concat(selected, ", ") or "—"
            addText(string.format("%s: %s\n%s: %s",
                _("Your answer"), yours, _("Correct"),
                table.concat(question.correct, ", ")), 20)
            if question.explanation and question.explanation ~= "" then
                group[#group + 1] = vSpan(10)
                addText(question.explanation, 20)
            end
        end
        group[#group + 1] = vSpan(L.QUESTION_GAP)
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

    local content_h = group:getSize().h
    local filler = math.max(0, self.dimen.h - content_h - 3 * padding)
    local final = VerticalGroup:new{ align = "left" }
    for i = 1, #group do
        final[i] = group[i]
    end
    final[#final + 1] = vSpan(filler)
    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        margin = 0,
        padding = padding,
        final,
    }
    self:refocusWidget()
    UIManager:setDirty(self, "ui")
end

--------------------------------------------------------------------------
-- exam logic (unchanged)
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
