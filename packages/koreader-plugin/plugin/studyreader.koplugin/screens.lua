--[[-- Screens: course/lesson menus and the flows that tie store + widgets together.]]

local ButtonDialog = require("ui/widget/buttondialog")
local InfoMessage = require("ui/widget/infomessage")
local Menu = require("ui/widget/menu")
local ReaderUI = require("apps/reader/readerui")
local UIManager = require("ui/uimanager")
local _ = require("gettext")

local QuizWidget = require("quiz")
local ReviewWidget = require("review")
local State = require("state")
local Store = require("store")

local Screens = {}

local stack = {}

local function push(widget)
    stack[#stack + 1] = widget
    UIManager:show(widget)
end

function Screens.closeAll()
    while #stack > 0 do
        UIManager:close(table.remove(stack))
    end
end

local function warn(text)
    UIManager:show(InfoMessage:new{ text = text, timeout = 3 })
end

local function courseProgressPercent(course, state)
    local total, done = 0, 0
    for _, lesson in ipairs(Store.lessons(course)) do
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
        local course, err = Store.open(entry.path, entry.mtime)
        if course then
            local state = State.load(course.id)
            items[#items + 1] = {
                text = course.manifest.title or entry.name,
                mandatory = courseProgressPercent(course, state),
                callback = function() Screens.courseMenu(course) end,
            }
        else
            items[#items + 1] = {
                text = string.format("%s (error)", entry.name),
                select_enabled = false,
                callback = function() warn(err or "cannot open course") end,
            }
        end
    end
    push(Menu:new{
        title = _("My courses"),
        item_table = items,
        covers_fullscreen = true,
        is_borderless = true,
        is_popout = false,
    })
end

function Screens.courseMenu(course)
    local state = State.load(course.id)
    local items = {}

    local due = 0
    for _, card in ipairs(course.flashcards) do
        local schedule = state.reviews[card.id]
            or require("srs").newCard()
        if require("srs").isDue(schedule) then due = due + 1 end
    end
    if #course.flashcards > 0 then
        items[#items + 1] = {
            text = string.format(_("Reviews (%d due)"), due),
            callback = function() Screens.startReviews(course) end,
        }
        items[#items + 1] = { text = "—" , select_enabled = false, separator = true }
    end

    local current_module = nil
    for _, lesson in ipairs(Store.lessons(course)) do
        if lesson.module_title ~= current_module then
            current_module = lesson.module_title
            items[#items + 1] = {
                text = current_module,
                bold = true,
                select_enabled = false,
                separator = true,
            }
        end
        local ids = Store.questionIdsForLesson(course, lesson)
        local answered = 0
        for _, id in ipairs(ids) do
            if State.answeredQuestion(state, id) then answered = answered + 1 end
        end
        local mark = State.completedLesson(state, lesson.id) and "✓ " or ""
        items[#items + 1] = {
            text = mark .. lesson.title,
            mandatory = #ids > 0 and string.format("%d/%d", answered, #ids) or nil,
            callback = function() Screens.lessonActions(course, lesson) end,
        }
    end

    push(Menu:new{
        title = course.manifest.title or course.id,
        item_table = items,
        covers_fullscreen = true,
        is_borderless = true,
        is_popout = false,
    })
end

function Screens.lessonActions(course, lesson)
    local dialog
    dialog = ButtonDialog:new{
        title = lesson.title,
        title_align = "center",
        buttons = {
            {
                {
                    text = _("Read lesson"),
                    callback = function()
                        UIManager:close(dialog)
                        Screens.openLesson(course, lesson)
                    end,
                },
            },
            {
                {
                    text = _("Quiz"),
                    callback = function()
                        UIManager:close(dialog)
                        Screens.startQuiz(course, lesson)
                    end,
                },
            },
            {
                {
                    text = _("Mark as read"),
                    callback = function()
                        UIManager:close(dialog)
                        local state = State.load(course.id)
                        State.markLessonDone(state, lesson.id)
                        State.save(course.id, state)
                    end,
                },
            },
        },
    }
    UIManager:show(dialog)
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
    Screens.closeAll()
    ReaderUI:showReader(path)
end

function Screens.startQuiz(course, lesson)
    local state = State.load(course.id)
    local ids = Store.questionIdsForLesson(course, lesson)
    if #ids == 0 then
        warn(_("This lesson has no quiz questions."))
        return
    end
    local answered = 0
    for _, id in ipairs(ids) do
        if State.answeredQuestion(state, id) then answered = answered + 1 end
    end
    if answered == #ids then
        warn(_("Quiz already completed. (Re-answering is not supported yet.)"))
        return
    end
    push(QuizWidget:new{
        course = course,
        lesson = lesson,
        question_ids = ids,
        state = state,
    })
end

function Screens.startReviews(course)
    local state = State.load(course.id)
    push(ReviewWidget:new{
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
        if course and #course.flashcards > 0 then
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
    push(Menu:new{
        title = _("Reviews — pick a course"),
        item_table = items,
        covers_fullscreen = true,
        is_borderless = true,
        is_popout = false,
    })
end

return Screens
