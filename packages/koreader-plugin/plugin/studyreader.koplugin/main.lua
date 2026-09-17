--[[-- StudyReader KOReader plugin: runtime for .study course packages.

Adds a "Study" entry to the main menu (reader and file manager) with course
list, continue-studying and flashcard reviews. See packages/study-format/SPEC.md
for the .study file format.
]]

local WidgetContainer = require("ui/widget/container/widgetcontainer")
local _ = require("gettext")

local Screens = require("screens")
local State = require("state")
local Store = require("store")

local Plugin = WidgetContainer:extend{
    name = "studyreader",
}

function Plugin:addToMainMenu(menu_items)
    menu_items.studyreader = {
        text = _("Study"),
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
