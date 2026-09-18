--[[-- StudyStore: discovers .study packages and turns them into usable courses.

A .study file is a ZIP with manifest.json, content/*.md, questions/questions.json,
flashcards/flashcards.json and assets/ (see the .study spec v1). The package is
read-only: lessons are rendered to XHTML under <koreader-data>/studyreader/render
so crengine can display them with full formatting.
]]

local Archiver = require("ffi/archiver")
local DataStorage = require("datastorage")
local JSON = require("json")
local logger = require("logger")
local lfs = require("libs/libkoreader-lfs")

local md2xhtml = require("md2xhtml")

local Store = {}

local course_cache = {}

local function renderRoot()
    return DataStorage:getDataDir() .. "/studyreader/render"
end

local function fileExists(path)
    return lfs.attributes(path, "mode") == "file"
end

local function dirExists(path)
    return lfs.attributes(path, "mode") == "directory"
end

local function ensureDir(path)
    if lfs.attributes(path, "mode") == "directory" then return true end
    local parent = path:match("^(.*)/[^/]+$")
    if parent and parent ~= "" and lfs.attributes(parent, "mode") ~= "directory" then
        ensureDir(parent)
    end
    local ok, err = lfs.mkdir(path)
    if not ok and lfs.attributes(path, "mode") ~= "directory" then
        logger.warn("studyreader: cannot create dir", path, err)
        return false
    end
    return true
end

local function plainReplace(haystack, old, new)
    local start = haystack:find(old, 1, true)
    if not start then return haystack end
    return haystack:sub(1, start - 1) .. new
        .. plainReplace(haystack:sub(start + #old), old, new)
end

local function shellEscape(path)
    return "'" .. path:gsub("'", "'\\''") .. "'"
end

function Store.getScanDirs()
    local seen = {}
    local dirs = {}
    local function add(dir)
        if dir and dir ~= "" and dirExists(dir) and not seen[dir] then
            seen[dir] = true
            dirs[#dirs + 1] = dir
        end
    end
    local home = G_reader_settings and G_reader_settings:readSetting("home_dir")
    if home then add(home .. "/study") end
    add("/mnt/us/documents/study")
    add(DataStorage:getDataDir() .. "/studyreader/courses")
    table.sort(dirs)
    return dirs
end

function Store.listCourses()
    local courses = {}
    for _, dir in ipairs(Store.getScanDirs()) do
        for entry in lfs.dir(dir) do
            if entry:match("%.study$") then
                local path = dir .. "/" .. entry
                if fileExists(path) then
                    courses[#courses + 1] = {
                        path = path,
                        name = entry:gsub("%.study$", ""),
                        mtime = lfs.attributes(path, "modification") or 0,
                    }
                end
            end
        end
    end
    table.sort(courses, function(a, b) return a.name < b.name end)
    return courses
end

local function readEntries(path, names)
    local arc = Archiver.Reader:new()
    if not arc:open(path) then
        return nil, "cannot open archive"
    end
    for _ in arc:iterate() do end
    local out = {}
    for _, name in ipairs(names) do
        out[name] = arc:extractToMemory(name)
    end
    arc:close()
    return out
end

local function readEntry(path, entry)
    local out, err = readEntries(path, { entry })
    if not out then
        return nil, err
    end
    if not out[entry] then
        return nil, "cannot read entry " .. entry
    end
    return out[entry]
end

function Store.open(path, mtime)
    local cached = course_cache[path]
    if cached and cached.mtime == mtime then
        return cached.course
    end
    local contents, err = readEntries(path, {
        "manifest.json",
        "questions/questions.json",
        "flashcards/flashcards.json",
    })
    if not contents then
        return nil, err
    end
    local manifest_raw = contents["manifest.json"]
    if not manifest_raw then
        return nil, "missing manifest.json"
    end
    local ok, manifest = pcall(JSON.decode, manifest_raw)
    if not ok or type(manifest) ~= "table" then
        return nil, "invalid manifest.json"
    end
    if (manifest.formatVersion or 0) > 1 then
        return nil, string.format(
            "This course requires Study Format v%d. Please update the StudyReader plugin.",
            manifest.formatVersion)
    end

    local questions = {}
    local questions_raw = contents["questions/questions.json"]
    if questions_raw then
        ok, questions = pcall(JSON.decode, questions_raw)
        if not ok or type(questions) ~= "table" then questions = {} end
    end

    local flashcards = {}
    local flashcards_raw = contents["flashcards/flashcards.json"]
    if flashcards_raw then
        ok, flashcards = pcall(JSON.decode, flashcards_raw)
        if not ok or type(flashcards) ~= "table" then flashcards = {} end
    end

    local course = {
        path = path,
        id = manifest.id or "unknown",
        manifest = manifest,
        questions = questions,
        flashcards = flashcards,
    }
    course_cache[path] = { mtime = mtime, course = course }
    return course
end

function Store.readLessonMarkdown(course, content_path)
    return readEntry(course.path, content_path)
end

function Store.lessons(course)
    local lessons = {}
    for _, module in ipairs(course.manifest.modules or {}) do
        for _, lesson in ipairs(module.lessons or {}) do
            lessons[#lessons + 1] = {
                id = lesson.id,
                title = lesson.title,
                content = lesson.content,
                module_title = module.title,
                module_id = module.id,
            }
        end
    end
    return lessons
end

function Store.lessonById(course, lesson_id)
    for _, lesson in ipairs(Store.lessons(course)) do
        if lesson.id == lesson_id then return lesson end
    end
    return nil
end

function Store.questionIdsForLesson(course, lesson)
    local markdown = Store.readLessonMarkdown(course, lesson.content)
    if not markdown then return {} end
    local parsed = md2xhtml.parseDirectives(markdown)
    return parsed.quizzes
end

local function extractAsset(course, asset_path, images_dir)
    local dest = images_dir .. "/" .. asset_path:gsub("/", "_")
    if fileExists(dest) then return dest end
    local arc = Archiver.Reader:new()
    if not arc:open(course.path) then return nil end
    for _ in arc:iterate() do end
    local ok = arc:extractToPath(asset_path, dest)
    if not ok then
        logger.warn("studyreader: extractAsset failed:", asset_path, arc.err)
    end
    arc:close()
    return ok and dest or nil
end

local function readStamp(course)
    local file = io.open(renderRoot() .. "/" .. course.id .. "/stamp", "rb")
    if not file then return nil end
    local stamp = file:read("*l")
    file:close()
    return stamp
end

function Store.renderLesson(course, lesson)
    local out_dir = renderRoot() .. "/" .. course.id
    local stamp = string.format("v%d|%s", course.manifest.version or 1, course.path)
    if readStamp(course) ~= stamp then
        os.execute("rm -rf " .. shellEscape(out_dir))
    end
    ensureDir(renderRoot())
    ensureDir(out_dir)
    ensureDir(out_dir .. "/images")
    local stamp_file = io.open(out_dir .. "/stamp", "wb")
    if stamp_file then
        stamp_file:write(stamp, "\n")
        stamp_file:close()
    end

    local xhtml_path = out_dir .. "/" .. lesson.id .. ".xhtml"
    local markdown = Store.readLessonMarkdown(course, lesson.content)
    if not markdown then
        return nil, "cannot read lesson content"
    end
    local parsed = md2xhtml.convert(markdown, lesson.title)
    for _, image_path in ipairs(parsed.images) do
        local extracted = extractAsset(course, image_path, out_dir .. "/images")
        if extracted then
            parsed.xhtml = plainReplace(
                parsed.xhtml,
                'src="' .. image_path .. '"',
                'src="images/' .. image_path:gsub("/", "_") .. '"')
        else
            parsed.xhtml = plainReplace(
                parsed.xhtml,
                'src="' .. image_path .. '"',
                'alt="missing image" src=""')
        end
    end
    local out = io.open(xhtml_path, "wb")
    if not out then
        return nil, "cannot write " .. xhtml_path
    end
    out:write(parsed.xhtml)
    out:close()
    return xhtml_path
end

return Store
