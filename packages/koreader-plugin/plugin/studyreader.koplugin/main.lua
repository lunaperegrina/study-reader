--[[-- StudyReader KOReader plugin: runtime for .study course packages.

Adds a "Study" entry to the main menu (reader and file manager) with course
list, continue-studying and flashcard reviews. See packages/study-format/SPEC.md
for the .study file format.

Also integrates with Simple UI (simpleui.koplugin) when present: registers a
Quick Action so Study is reachable from the Simple UI homescreen, and a
KOReader dispatcher action ("study_open") bindable to gestures and Simple UI
custom actions.
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

function Plugin:init()
    self:_registerSimpleUIAction()
    UIManager:scheduleIn(5, function()
        self:_registerSimpleUIAction()
    end)
end

function Plugin:onReaderReady()
    self:_registerSimpleUIAction()
end

function Plugin:addToMainMenu(menu_items)
    self:_registerSimpleUIAction()
    menu_items.studyreader = {
        text = _("Study"),
        sorting_hint = "tools",
        sub_item_table = {
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
                separator = true,
            },
        },
    }
end

return Plugin
