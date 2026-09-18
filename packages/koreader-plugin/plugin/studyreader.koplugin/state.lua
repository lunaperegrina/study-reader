--[[-- Per-course user state (progress, quiz answers, SRS reviews).

State never lives inside the .study package (it is immutable): it is stored
as JSON files under <koreader-data>/studyreader/data/<course-id>/.
]]

local DataStorage = require("datastorage")
local JSON = require("json")
local logger = require("logger")
local lfs = require("libs/libkoreader-lfs")

local State = {}

local function dataRoot()
    return DataStorage:getDataDir() .. "/studyreader/data"
end

local function ensureDir(path)
    local parts = {}
    for part in path:gmatch("[^/]+") do
        parts[#parts + 1] = part
    end
    local current = path:sub(1, 1) == "/" and ("/" .. parts[1]) or parts[1]
    for i = 2, #parts do
        current = current .. "/" .. parts[i]
        if lfs.attributes(current, "mode") ~= "directory" then
            lfs.mkdir(current)
        end
    end
end

local function readJsonFile(path)
    local file = io.open(path, "rb")
    if not file then return nil end
    local content = file:read("*all")
    file:close()
    if not content or content == "" then return nil end
    local ok, value = pcall(JSON.decode, content)
    if not ok or value == nil then
        logger.warn("studyreader: invalid JSON in", path)
        return nil
    end
    return value
end

local function writeJsonFile(path, value)
    local ok, encoded = pcall(JSON.encode, value)
    if not ok or encoded == nil then
        logger.warn("studyreader: cannot encode JSON for", path)
        return false
    end
    local file = io.open(path, "wb")
    if not file then return false end
    file:write(encoded)
    file:close()
    return true
end

function State.courseDir(course_id)
    return string.format("%s/%s", dataRoot(), course_id or "unknown")
end

function State.load(course_id)
    local dir = State.courseDir(course_id)
    return {
        progress = readJsonFile(dir .. "/progress.json") or {},
        answers = readJsonFile(dir .. "/answers.json") or {},
        reviews = readJsonFile(dir .. "/reviews.json") or {},
    }
end

function State.save(course_id, state)
    local dir = State.courseDir(course_id)
    ensureDir(dir)
    writeJsonFile(dir .. "/progress.json", state.progress)
    writeJsonFile(dir .. "/answers.json", state.answers)
    writeJsonFile(dir .. "/reviews.json", state.reviews)
end

function State.setLastCourse(course_id, lesson_id)
    ensureDir(dataRoot())
    writeJsonFile(dataRoot() .. "/last.json", {
        courseId = course_id,
        lessonId = lesson_id,
        at = os.time(),
    })
end

function State.getLastCourse()
    return readJsonFile(dataRoot() .. "/last.json")
end

function State.completedLesson(state, lesson_id)
    return state.progress.completedLessons
        and state.progress.completedLessons[lesson_id] == true
end

function State.markLessonDone(state, lesson_id)
    state.progress.completedLessons = state.progress.completedLessons or {}
    if not state.progress.completedLessons[lesson_id] then
        state.progress.completedLessons[lesson_id] = os.date("!%Y-%m-%dT%H:%M:%SZ")
    end
end

function State.answeredQuestion(state, question_id)
    return state.answers[question_id] ~= nil
end

function State.recordAnswer(state, question_id, selected, correct)
    state.answers[question_id] = {
        selected = selected,
        correct = correct,
        answeredAt = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    }
end

return State
