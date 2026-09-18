--[[-- StudyStore: discovers .study packages and turns them into usable courses.

A .study file is a ZIP with manifest.json, content/*.md, questions/questions.json,
flashcards/flashcards.json and assets/ (see the .study spec v1). The package is
read-only.

Performance model: opening a course either hits the on-disk cache
(<koreader-data>/studyreader/cache/<course-id>/, stamped by version+mtime) or
extracts the whole archive in a SINGLE sequential pass. Lesson markdown lives
in memory; question/flashcard banks decode lazily; lesson XHTML renders once
per course version (into cache_dir/render/) and references extracted assets
by relative path.
]]

local Archiver = require("ffi/archiver")
local DataStorage = require("datastorage")
local JSON = require("json")
local logger = require("logger")
local lfs = require("libs/libkoreader-lfs")

local md2xhtml = require("md2xhtml")

local Store = {}

local course_cache = {}

local function studyRoot()
    return DataStorage:getDataDir() .. "/studyreader"
end

function Store.cacheDir(course_id)
    return string.format("%s/cache/%s", studyRoot(), course_id or "unknown")
end

local function fileExists(path)
    return lfs.attributes(path, "mode") == "file"
end

local function dirExists(path)
    return lfs.attributes(path, "mode") == "directory"
end

local function shellEscape(path)
    return "'" .. path:gsub("'", "'\\''") .. "'"
end

local function ensureDir(path)
    if dirExists(path) then return true end
    local parent = path:match("^(.*)/[^/]+$")
    if parent and parent ~= "" and not dirExists(parent) then
        ensureDir(parent)
    end
    local ok, err = lfs.mkdir(path)
    if not ok and not dirExists(path) then
        logger.warn("studyreader: cannot create dir", path, err)
        return false
    end
    return true
end

local function readTextFile(path)
    local file = io.open(path, "rb")
    if not file then return nil end
    local content = file:read("*all")
    file:close()
    return content
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
    add(studyRoot() .. "/courses")
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

local function currentStamp(path, version)
    return string.format("v%d|%s", version or 1, path)
end

local function readStamp(cache_dir)
    return readTextFile(cache_dir .. "/stamp")
end

local function writeStamp(cache_dir, path, version)
    local file = io.open(cache_dir .. "/stamp", "wb")
    if file then
        file:write(currentStamp(path, version), "\n")
        file:close()
    end
end

local function extractToCache(path, cache_dir)
    ensureDir(cache_dir)
    os.execute("rm -rf " .. shellEscape(cache_dir))
    ensureDir(cache_dir)
    local arc = Archiver.Reader:new()
    if not arc:open(path) then
        return nil, "cannot open archive"
    end
    for entry in arc:iterate() do
        if entry.mode == "file" then
            local dest = cache_dir .. "/" .. entry.path
            local dest_dir = dest:match("^(.*)/[^/]+$")
            if dest_dir then ensureDir(dest_dir) end
            if not arc:extractToPath(entry.path, dest) then
                logger.warn("studyreader: extract failed:", entry.path, arc.err)
            end
        end
    end
    arc:close()
    return true
end

local function loadFromCache(cache_dir, path, mtime)
    local manifest_raw = readTextFile(cache_dir .. "/manifest.json")
    if not manifest_raw then return nil end
    local ok, manifest = pcall(JSON.decode, manifest_raw)
    if not ok or type(manifest) ~= "table" then return nil end
    if (manifest.formatVersion or 0) > 1 then
        return nil, string.format(
            "This course requires Study Format v%d. Please update the StudyReader plugin.",
            manifest.formatVersion)
    end

    local lesson_md = {}
    for module in lfs.dir(cache_dir .. "/content") do
        if module:match("%.md$") then
            local content = readTextFile(cache_dir .. "/content/" .. module)
            if content then lesson_md["content/" .. module] = content end
        end
    end

    return {
        path = path,
        mtime = mtime,
        id = manifest.id or "unknown",
        manifest = manifest,
        lesson_md = lesson_md,
        questions_raw = readTextFile(cache_dir .. "/questions/questions.json"),
        flashcards_raw = readTextFile(cache_dir .. "/flashcards/flashcards.json"),
        cache_dir = cache_dir,
        _questions = false,
        _flashcards = false,
    }
end

function Store.isCached(path, mtime)
    local cached = course_cache[path]
    if cached and cached.mtime == mtime then
        return true
    end
    local arc = Archiver.Reader:new()
    if not arc:open(path) then return false end
    local manifest_raw
    for entry in arc:iterate() do
        if entry.path == "manifest.json" and entry.mode == "file" then
            manifest_raw = arc:extractToMemory("manifest.json")
            break
        end
    end
    arc:close()
    if not manifest_raw then return false end
    local ok, manifest = pcall(JSON.decode, manifest_raw)
    if not ok or type(manifest) ~= "table" then return false end
    return readStamp(Store.cacheDir(manifest.id or "unknown"))
        == currentStamp(path, manifest.version)
end

function Store.open(path, mtime)
    local cached = course_cache[path]
    if cached and cached.mtime == mtime then
        return cached.course
    end

    local manifest_probe = nil
    local arc = Archiver.Reader:new()
    if arc:open(path) then
        for entry in arc:iterate() do
            if entry.path == "manifest.json" and entry.mode == "file" then
                manifest_probe = arc:extractToMemory("manifest.json")
                break
            end
        end
        arc:close()
    end
    if not manifest_probe then
        return nil, "cannot read manifest.json"
    end
    local ok, manifest = pcall(JSON.decode, manifest_probe)
    if not ok or type(manifest) ~= "table" then
        return nil, "invalid manifest.json"
    end
    if (manifest.formatVersion or 0) > 1 then
        return nil, string.format(
            "This course requires Study Format v%d. Please update the StudyReader plugin.",
            manifest.formatVersion)
    end

    local cache_dir = Store.cacheDir(manifest.id or "unknown")
    if readStamp(cache_dir) ~= currentStamp(path, manifest.version) then
        local extracted, err = extractToCache(path, cache_dir)
        if not extracted then
            return nil, err
        end
        writeStamp(cache_dir, path, manifest.version)
    end

    course = loadFromCache(cache_dir, path, mtime)
    if not course then
        return nil, "cache is inconsistent — reopen the course to re-extract"
    end
    course_cache[path] = { mtime = mtime, course = course }
    return course
end

function Store.getQuestions(course)
    if course._questions == false then
        course._questions = {}
        if course.questions_raw then
            local ok, value = pcall(JSON.decode, course.questions_raw)
            if ok and type(value) == "table" then course._questions = value end
        end
    end
    return course._questions
end

function Store.getFlashcards(course)
    if course._flashcards == false then
        course._flashcards = {}
        if course.flashcards_raw then
            local ok, value = pcall(JSON.decode, course.flashcards_raw)
            if ok and type(value) == "table" then course._flashcards = value end
        end
    end
    return course._flashcards
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

function Store.modules(course)
    local modules = {}
    for _, module in ipairs(course.manifest.modules or {}) do
        local lessons = {}
        for _, lesson in ipairs(module.lessons or {}) do
            lessons[#lessons + 1] = {
                id = lesson.id,
                title = lesson.title,
                content = lesson.content,
                module_title = module.title,
                module_id = module.id,
            }
        end
        modules[#modules + 1] = { id = module.id, title = module.title, lessons = lessons }
    end
    return modules
end

function Store.lessonMarkdown(course, content_path)
    return course.lesson_md[content_path]
end

function Store.lessonById(course, lesson_id)
    for _, lesson in ipairs(Store.lessons(course)) do
        if lesson.id == lesson_id then return lesson end
    end
    return nil
end

function Store.nextLesson(course, lesson_id)
    local lessons = Store.lessons(course)
    for i, lesson in ipairs(lessons) do
        if lesson.id == lesson_id then
            return lessons[i + 1]
        end
    end
    return nil
end

function Store.questionIdsForLesson(course, lesson)
    local markdown = Store.lessonMarkdown(course, lesson.content)
    if not markdown then return {} end
    return md2xhtml.parseDirectives(markdown).quizzes
end

function Store.renderLesson(course, lesson)
    local render_dir = course.cache_dir .. "/render"
    if not ensureDir(render_dir) then
        return nil, "cannot create render dir"
    end
    local xhtml_path = render_dir .. "/" .. lesson.id .. ".xhtml"
    if fileExists(xhtml_path) then
        return xhtml_path
    end

    local markdown = Store.lessonMarkdown(course, lesson.content)
    if not markdown then
        return nil, "cannot read lesson content"
    end
    local parsed = md2xhtml.convert(markdown, lesson.title, "../")
    local out = io.open(xhtml_path, "wb")
    if not out then
        return nil, "cannot write " .. xhtml_path
    end
    out:write(parsed.xhtml)
    out:close()
    return xhtml_path
end

return Store
