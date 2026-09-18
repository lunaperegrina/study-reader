--[[-- Screens: course/module/lesson menus and the flows that tie store + widgets together.

v2 flow (Ensina Dev style): tapping a lesson opens it directly in the reader;
the quiz is offered at the end of the lesson (see main.lua) and chains into
the next lesson from the quiz summary.
]]

local InfoMessage = require("ui/widget/infomessage")
local Menu = require("ui/widget/menu")
local ReaderUI = require("apps/reader/readerui")
local UIManager = require("ui/uimanager")
local logger = require("logger")
local _ = require("gettext")

local QuizWidget = require("quiz")
local ReviewWidget = require("review")
local State = require("state")
local Store = require("store")

local Screens = {}

local stack = {}
Screens.active = nil

local function untrack(widget)
    for i = #stack, 1, -1 do
        if stack[i] == widget then
            table.remove(stack, i)
        end
    end
end

local function pushMenu(props)
    props.covers_fullscreen = true
    props.is_borderless = true
    props.is_popout = false
    local menu = Menu:new(props)
    stack[#stack + 1] = menu
    menu.close_callback = function()
        untrack(menu)
    end
    UIManager:show(menu)
    return menu
end

local function pushChildMenu(props)
    props.title_bar_left_icon = "chevron.left"
    local menu = pushMenu(props)
    menu.onLeftButtonTap = function()
        untrack(menu)
        UIManager:close(menu)
    end
    return menu
end

local function pushWidget(widget)
    stack[#stack + 1] = widget
    widget.onExit = function()
        untrack(widget)
    end
    UIManager:show(widget)
end

function Screens.pop()
    local top = table.remove(stack)
    if top then
        UIManager:close(top)
    end
end

function Screens.closeAll()
    while #stack > 0 do
        UIManager:close(table.remove(stack))
    end
end

local function warn(text)
    UIManager:show(InfoMessage:new{ text = text, timeout = 3 })
end

local function openCourse(entry)
    if not Store.isCached(entry.path, entry.mtime) then
        local preparing = InfoMessage:new{ text = _("Preparing course (first time only)…") }
        UIManager:show(preparing)
        UIManager:forceRePaint()
        local course, err = Store.open(entry.path, entry.mtime)
        UIManager:close(preparing)
        return course, err
    end
    return Store.open(entry.path, entry.mtime)
end

local function modulePercent(course, state, module)
    local total, done = 0, 0
    for _, lesson in ipairs(module.lessons) do
        total = total + 1
        if State.completedLesson(state, lesson.id) then done = done + 1 end
    end
    if total == 0 then return "0%" end
    return string.format("%d%%", math.floor(done * 100 / total))
end

function Screens.myCourses()
    local courses = Store.listCourses()
    if #courses == 0 then
        warn(_("No .study courses found. Copy them to a 'study' folder inside your documents directory."))
        return
    end
    local items = {}
    for _, entry in ipairs(courses) do
        local course, err = openCourse(entry)
        if course then
            local state = State.load(course.id)
            local total, done = 0, 0
            for _, lesson in ipairs(Store.lessons(course)) do
                total = total + 1
                if State.completedLesson(state, lesson.id) then done = done + 1 end
            end
            local pct = total > 0 and string.format("%d%%", math.floor(done * 100 / total)) or "0%"
            items[#items + 1] = {
                text = course.manifest.title or entry.name,
                mandatory = pct,
                callback = function() Screens.courseMenu(course) end,
            }
        else
            logger.warn("studyreader: cannot open course", entry.path, err)
            items[#items + 1] = {
                text = string.format("%s (error)", entry.name),
                select_enabled = false,
                callback = function() warn(err or "cannot open course") end,
            }
        end
    end
    pushMenu({
        title = _("My courses"),
        item_table = items,
    })
end

function Screens.courseMenu(course)
    local state = State.load(course.id)

    local due = 0
    local deck = Store.getFlashcards(course)
    if #deck > 0 then
        local SRS = require("srs")
        for _, card in ipairs(deck) do
            local schedule = state.reviews[card.id] or SRS.newCard()
            if SRS.isDue(schedule) then due = due + 1 end
        end
    end

    local items = {}
    if #deck > 0 then
        items[#items + 1] = {
            text = string.format(_("Reviews (%d due)"), due),
            callback = function() Screens.startReviews(course) end,
        }
        items[#items + 1] = { text = "—", select_enabled = false, separator = true }
    end
    for _, module in ipairs(Store.modules(course)) do
        items[#items + 1] = {
            text = module.title,
            mandatory = modulePercent(course, state, module),
            callback = function() Screens.moduleMenu(course, module) end,
        }
    end

    pushChildMenu({
        title = course.manifest.title or course.id,
        item_table = items,
    })
end

function Screens.moduleMenu(course, module)
    local state = State.load(course.id)
    local items = {}
    for _, lesson in ipairs(module.lessons) do
        local ids = Store.questionIdsForLesson(course, lesson)
        local answered = 0
        for _, id in ipairs(ids) do
            if State.answeredQuestion(state, id) then answered = answered + 1 end
        end
        local mark = State.completedLesson(state, lesson.id) and "✓ " or ""
        items[#items + 1] = {
            text = mark .. lesson.title,
            mandatory = #ids > 0 and string.format("%d/%d", answered, #ids) or nil,
            callback = function() Screens.openLesson(course, lesson) end,
        }
    end
    pushChildMenu({
        title = module.title,
        item_table = items,
    })
end

function Screens.openLesson(course, lesson)
    local path, err = Store.renderLesson(course, lesson)
    if not path then
        warn(err or _("cannot render lesson"))
        return
    end
    local state = State.load(course.id)
    state.progress.currentLesson = lesson.id
    State.save(course.id, state)
    State.setLastCourse(course.id, lesson.id)
    Screens.active = { course = course, lesson = lesson }
    Screens.closeAll()
    ReaderUI:showReader(path)
end

function Screens.startQuiz(course, lesson, practice)
    local state = State.load(course.id)
    local ids = Store.questionIdsForLesson(course, lesson)
    if #ids == 0 then
        warn(_("This lesson has no quiz questions."))
        return
    end
    course.questions = Store.getQuestions(course)
    local next_lesson = Store.nextLesson(course, lesson.id)
    pushWidget(QuizWidget:new{
        course = course,
        lesson = lesson,
        question_ids = ids,
        state = state,
        practice = practice or false,
        next_lesson = next_lesson,
        onNext = next_lesson and function()
            Screens.openLesson(course, next_lesson)
        end or nil,
    })
end

function Screens.startReviews(course)
    local state = State.load(course.id)
    course.flashcards = Store.getFlashcards(course)
    pushWidget(ReviewWidget:new{
        course = course,
        state = state,
    })
end

function Screens.continueStudying()
    local last = State.getLastCourse()
    if not last then
        Screens.myCourses()
        return
    end
    for _, entry in ipairs(Store.listCourses()) do
        local course = Store.open(entry.path, entry.mtime)
        if course and course.id == last.courseId then
            local lesson = Store.lessonById(course, last.lessonId)
                or Store.lessons(course)[1]
            if lesson then
                Screens.openLesson(course, lesson)
                return
            end
        end
    end
    Screens.myCourses()
end

function Screens.reviewsFlow()
    local candidates = {}
    for _, entry in ipairs(Store.listCourses()) do
        local course = Store.open(entry.path, entry.mtime)
        if course and #Store.getFlashcards(course) > 0 then
            candidates[#candidates + 1] = course
        end
    end
    if #candidates == 0 then
        warn(_("No courses with flashcards."))
        return
    end
    if #candidates == 1 then
        Screens.startReviews(candidates[1])
        return
    end
    local items = {}
    for _, course in ipairs(candidates) do
        items[#items + 1] = {
            text = course.manifest.title or course.id,
            callback = function() Screens.startReviews(course) end,
        }
    end
    pushMenu({
        title = _("Reviews — pick a course"),
        item_table = items,
    })
end

return Screens
