--[[-- StudyReader KOReader plugin: runtime for .study course packages.

Adds a "Study" entry to the main menu (reader and file manager) with course
list, continue-studying and flashcard reviews. See packages/study-format/SPEC.md
for the .study file format.

Flow: tapping a lesson opens it directly; the end of the rendered lesson
carries inline CTAs (studyreader:// links inside the text — quiz, next lesson,
back to lessons) intercepted by patching the reader's ReaderLink instance
(same pattern simpleui.koplugin uses). No modals. Also integrates with Simple
UI via a Quick Action and registers a dispatcher action ("study_open").
]]

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

function Plugin:_handleStudyLink(url)
    local active = Screens.active
    if not active then return false end
    local action = url:match("^studyreader://(%a+)$")
    if action == "quiz" then
        local state = State.load(active.course.id)
        local practice = State.completedLesson(state, active.lesson.id)
        Screens.startQuiz(active.course, active.lesson, practice)
        return true
    end
    if action == "next" then
        local next_lesson = Store.nextLesson(active.course, active.lesson.id)
        if next_lesson then
            Screens.openLesson(active.course, next_lesson)
            return true
        end
        return false
    end
    if action == "menu" then
        local module
        for _, candidate in ipairs(Store.modules(active.course)) do
            if candidate.id == active.lesson.module_id then
                module = candidate
                break
            end
        end
        if module then
            Screens.moduleMenu(active.course, module)
            return true
        end
        return false
    end
    return false
end

function Plugin:_patchReaderLink()
    local link = self.ui and self.ui.link
    if not link or link._studyreader_patched then return end
    local plugin = self
    local original = link.onGotoLink
    link.onGotoLink = function(this, l, neglect_current_location, allow_footnote_popup)
        local url = type(l) == "table" and (l.xpointer or l.uri or "") or ""
        if type(url) == "string" and url:match("^studyreader://") then
            if plugin:_handleStudyLink(url) then
                return true
            end
        end
        return original(this, l, neglect_current_location, allow_footnote_popup)
    end
    link._studyreader_patched = true
    logger.dbg("studyreader: ReaderLink patched for inline CTAs")
end

function Plugin:_cleanHistory()
    local ok, ReadHistory = pcall(require, "readhistory")
    if not ok or type(ReadHistory) ~= "table" or type(ReadHistory.hist) ~= "table" then
        return
    end
    local removed = false
    for i = #ReadHistory.hist, 1, -1 do
        local file = ReadHistory.hist[i].file
        if type(file) == "string"
            and (file:find("/studyreader/render", 1, true)
                or file:find("/studyreader/cache", 1, true)) then
            ReadHistory:removeItem(ReadHistory.hist[i], i, true)
            removed = true
        end
    end
    if removed then
        ReadHistory:_flush()
    end
    local lastfile = G_reader_settings and G_reader_settings:readSetting("lastfile")
    if type(lastfile) == "string"
        and (lastfile:find("/studyreader/render", 1, true)
            or lastfile:find("/studyreader/cache", 1, true)) then
        if #ReadHistory.hist > 0 then
            G_reader_settings:saveSetting("lastfile", ReadHistory.hist[1].file)
        else
            pcall(function() G_reader_settings:delSetting("lastfile") end)
        end
        pcall(function() G_reader_settings:flush() end)
    end
end

function Plugin:init()
    -- FileManagerMenu/ReaderMenu only call addToMainMenu() on registered widgets.
    if self.ui and self.ui.menu then
        self.ui.menu:registerToMainMenu(self)
    end
    self:_registerSimpleUIAction()
    self:_cleanHistory()
    UIManager:scheduleIn(5, function()
        self:_registerSimpleUIAction()
    end)
end

function Plugin:onReaderReady()
    self:_registerSimpleUIAction()
    self:_patchReaderLink()
    self:_cleanHistory()
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
