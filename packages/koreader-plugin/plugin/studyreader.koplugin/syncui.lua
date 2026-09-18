--[[-- Sync UI glue: pairing dialogs, "sync now" and course downloader.

Uses KOReader InputDialog/InfoMessage/Menu on top of the pure sync.lua module.
]]

local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local Menu = require("ui/widget/menu")
local UIManager = require("ui/uimanager")
local _ = require("gettext")

local logger = require("logger")
local Store = require("store")
local Sync = require("sync")

local SyncUI = {}

local function inform(text)
    UIManager:show(InfoMessage:new{ text = text, timeout = 4 })
end

local function lastServer()
    local config = Sync.loadConfig()
    return config and config.server or nil
end

function SyncUI.pairDialog()
    local dialog
    dialog = InputDialog:new{
        title = _("Server address"),
        input = lastServer() or "",
        input_hint = "http://host:3001",
        buttons = {{
            {
                text = _("Cancel"),
                callback = function()
                    UIManager:close(dialog)
                end,
            },
            {
                text = _("Next"),
                is_enter_default = true,
                callback = function()
                    local server = dialog:getInputText()
                    UIManager:close(dialog)
                    SyncUI.codeDialog(server)
                end,
            },
        }},
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function SyncUI.codeDialog(server)
    local dialog
    dialog = InputDialog:new{
        title = _("Pairing code"),
        -- pairing codes are uppercase; force the uppercase keyboard page
        input_type = "string",
        input_hint = _("6 characters, shown on the web in Settings"),
        buttons = {{
            {
                text = _("Cancel"),
                callback = function()
                    UIManager:close(dialog)
                end,
            },
            {
                text = _("Pair"),
                is_enter_default = true,
                callback = function()
                    local code = dialog:getInputText():upper():gsub("%s", "")
                    UIManager:close(dialog)
                    if #code ~= 6 then
                        inform(_("The code has 6 characters."))
                        return
                    end
                    local ok, err = Sync.pair(server, code, "KOReader")
                    if ok then
                        inform(_("Paired! You can now sync and download your courses."))
                    else
                        inform(_("Pairing failed: ") .. tostring(err))
                    end
                end,
            },
        }},
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function SyncUI.syncNow()
    if not Sync.paired() then
        SyncUI.pairDialog()
        return
    end

    local remote, err = Sync.listCourses()
    if not remote then
        inform(_("Could not list courses: ") .. tostring(err))
        return
    end

    local local_ids = {}
    for _, entry in ipairs(Store.listCourses()) do
        local_ids[entry.name] = true
    end

    local synced, skipped = 0, 0
    for _, course in ipairs(remote) do
        if local_ids[course.courseId] then
            local ok, sync_err = pcall(Sync.syncCourse, course.courseId)
            if ok then
                synced = synced + 1
            else
                skipped = skipped + 1
                logger.warn("studyreader: sync failed for", course.courseId, sync_err)
            end
        end
    end
    inform(string.format(_("Synced courses: %d (%d failed)"), synced, skipped))
end

function SyncUI.downloadMenu()
    if not Sync.paired() then
        SyncUI.pairDialog()
        return
    end

    local courses, err = Sync.listCourses()
    if not courses then
        inform(_("Could not list courses: ") .. tostring(err))
        return
    end
    if #courses == 0 then
        inform(_("No courses in your account yet."))
        return
    end

    local items = {}
    for _, course in ipairs(courses) do
        items[#items + 1] = {
            text = string.format("%s (%d lessons)", course.title, course.lessonCount or 0),
            callback = function()
                local dest, download_err = Sync.downloadCourse(course.courseId)
                if dest then
                    inform(_("Downloaded to ") .. dest)
                else
                    inform(_("Download failed: ") .. tostring(download_err))
                end
            end,
        }
    end

    UIManager:show(Menu:new{
        title = _("My courses (account)"),
        item_table = items,
        is_borderless = false,
        is_popout = false,
    })
end

return SyncUI
