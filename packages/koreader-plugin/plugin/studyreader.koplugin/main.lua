--[[-- StudyReader KOReader plugin: runtime for .study course packages.

Adds a "Study" entry to the main menu (reader and file manager) with course
list, continue-studying and flashcard reviews. See packages/study-format/SPEC.md
for the .study file format.

v2 flow (Ensina Dev style): tapping a lesson opens it directly; reaching the
last page offers the lesson quiz; the quiz summary chains into the next
lesson. Also integrates with Simple UI (simpleui.koplugin) when present via a
Quick Action, and registers a dispatcher action ("study_open").
]]

local ConfirmBox = require("ui/widget/confirmbox")
local Dispatcher = require("dispatcher")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")
local _ = require("gettext")

local Screens = require("screens")
local State = require("state")
local Store = require("store")

local Plugin = WidgetContainer:extend{
    name = "studyreader",
}

Dispatcher:registerAction("study_open", {
    category = "none",
    event = "StudyOpen",
    title = _("Study"),
    general = true,
})

function Plugin:onStudyOpen()
    Screens.myCourses()
end

function Plugin:_registerSimpleUIAction()
    if self._sui_registered then return end
    local ok, QA = pcall(require, "features/sui_quickactions")
    if not ok or type(QA) ~= "table" or type(QA.register) ~= "function" then
        logger.dbg("studyreader: Simple UI not available (", tostring(QA), ")")
        return
    end
    QA.register({
        id = "studyreader_open",
        label = _("Study"),
        execute = function()
            Screens.myCourses()
        end,
    })
    self._sui_registered = true
    logger.info("studyreader: Simple UI quick action registered")
end

function Plugin:init()
    self:_registerSimpleUIAction()
    UIManager:scheduleIn(5, function()
        self:_registerSimpleUIAction()
    end)
end

function Plugin:onReaderReady()
    self:_registerSimpleUIAction()
end

function Plugin:onPageUpdate(page)
    local active = Screens.active
    if not active or not self.ui or not self.ui.document then return end
    local lesson_key = active.course.id .. "/" .. active.lesson.id
    if self._end_lesson ~= lesson_key then
        self._end_lesson = lesson_key
        self._end_asked = false
    end
    if self._end_asked then return end
    local ok, total = pcall(function()
        return self.ui.document:getPageCount()
    end)
    if not ok or not total or total < 1 then return end
    if page < total then return end
    self._end_asked = true
    UIManager:show(ConfirmBox:new{
        text = _("End of lesson — take the quiz?"),
        ok_text = _("Take quiz"),
        cancel_text = _("Keep reading"),
        ok_callback = function()
            local state = State.load(active.course.id)
            local practice = State.completedLesson(state, active.lesson.id)
            Screens.startQuiz(active.course, active.lesson, practice)
        end,
    })
end

function Plugin:onCloseDocument()
    Screens.active = nil
    self._end_lesson = nil
    self._end_asked = false
end

function Plugin:_finishActiveLesson()
    local active = Screens.active
    if not active then return end
    local state = State.load(active.course.id)
    local practice = State.completedLesson(state, active.lesson.id)
    Screens.startQuiz(active.course, active.lesson, practice)
end

function Plugin:addToMainMenu(menu_items)
    self:_registerSimpleUIAction()
    menu_items.studyreader = {
        text = _("Study"),
        sorting_hint = "tools",
        sub_item_table_func = function()
            local items = {
                {
                    text = _("My courses"),
                    callback = function() Screens.myCourses() end,
                },
                {
                    text = _("Continue studying"),
                    callback = function() Screens.continueStudying() end,
                },
                {
                    text = _("Reviews"),
                    callback = function() Screens.reviewsFlow() end,
                },
            }
            if Screens.active then
                items[#items + 1] = {
                    text = _("Finish lesson & quiz"),
                    callback = function() self:_finishActiveLesson() end,
                    separator = true,
                }
            end
            return items
        end,
    }
end

return Plugin
