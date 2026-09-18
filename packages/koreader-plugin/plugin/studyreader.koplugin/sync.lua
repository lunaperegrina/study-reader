--[[-- Cloud sync: account pairing, course download and state sync over HTTPS.

Talks to a study-reader platform instance (self-hosted or official). The device
token lives in <koreader-data>/studyreader/sync.json; course state merges are
per-key last-write-wins on the same fields the server merges (answeredAt,
gradedAt, completedLessons timestamps), so web and Kindle converge.
]]

local DataStorage = require("datastorage")
local JSON = require("json")
local logger = require("logger")
local lfs = require("libs/libkoreader-lfs")

local State = require("state")

local Sync = {}

local API = "/api/v1"

-- ssl.https/ltn12 only exist inside KOReader; loaded lazily so this module
-- stays loadable in standalone luajit tests.
local function http_client()
    local ok_https, https = pcall(require, "ssl.https")
    local ok_ltn12, ltn12 = pcall(require, "ltn12")
    if not ok_https or not ok_ltn12 then
        return nil, "HTTPS indisponível neste ambiente"
    end
    return https, ltn12
end

function Sync.configPath()
    return DataStorage:getDataDir() .. "/studyreader/sync.json"
end

function Sync.coursesDir()
    return DataStorage:getDataDir() .. "/studyreader/courses"
end

function Sync.loadConfig()
    local file = io.open(Sync.configPath(), "rb")
    if not file then return nil end
    local content = file:read("*all")
    file:close()
    if not content or content == "" then return nil end
    local ok, config = pcall(JSON.decode, content)
    if not ok or type(config) ~= "table" then return nil end
    if type(config.server) ~= "string" or type(config.token) ~= "string" then
        return nil
    end
    return config
end

function Sync.saveConfig(config)
    local path = Sync.configPath()
    local dir = path:match("^(.*)/[^/]+$")
    if dir and lfs.attributes(dir, "mode") ~= "directory" then
        pcall(function() lfs.mkdir(dir) end)
    end
    local file = io.open(path, "wb")
    if not file then return false end
    file:write(JSON.encode(config))
    file:close()
    return true
end

function Sync.paired()
    return Sync.loadConfig() ~= nil
end

local function trim_trailing_slash(server)
    return (server:gsub("/+$", ""))
end

local function request(config, method, path, body)
    local https, ltn12, unavailable = http_client()
    if not https then return nil, unavailable end

    local chunks = {}
    local headers = {
        ["Authorization"] = "Bearer " .. config.token,
        ["Accept"] = "application/json",
    }
    if body then
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = tostring(#body)
    end
    local ok, status = https.request({
        url = config.server .. path,
        method = method,
        headers = headers,
        source = body and ltn12.source.string(body) or nil,
        sink = ltn12.sink.table(chunks),
    })
    if not ok then
        return nil, tostring(status)
    end
    if status ~= 200 and status ~= 201 then
        return nil, string.format("HTTP %s", tostring(status))
    end
    return table.concat(chunks)
end

local function request_json(config, method, path, payload)
    local body = payload and JSON.encode(payload) or nil
    local raw, err = request(config, method, path, body)
    if not raw then return nil, err end
    if raw == "" then return {} end
    local ok, decoded = pcall(JSON.decode, raw)
    if not ok or decoded == nil then
        return nil, "resposta inválida do servidor"
    end
    return decoded
end

local function pair_request(server, code, name)
    local https, ltn12, unavailable = http_client()
    if not https then return nil, unavailable end

    local chunks = {}
    local body = JSON.encode({ code = code, name = name })
    local ok, status = https.request({
        url = trim_trailing_slash(server) .. API .. "/devices/pair",
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#body),
        },
        source = ltn12.source.string(body),
        sink = ltn12.sink.table(chunks),
    })
    if not ok then
        return nil, tostring(status)
    end
    if status ~= 200 and status ~= 201 then
        return nil, string.format("HTTP %s", tostring(status))
    end
    local ok_decode, decoded = pcall(JSON.decode, table.concat(chunks))
    if not ok_decode or type(decoded) ~= "table" or type(decoded.deviceToken) ~= "string" then
        return nil, "resposta de pareamento inválida"
    end
    return decoded
end

function Sync.pair(server, code, name)
    local decoded, err = pair_request(server, code, name or "KOReader")
    if not decoded then return false, err end
    local saved = Sync.saveConfig({
        server = trim_trailing_slash(server),
        token = decoded.deviceToken,
        pairedAt = os.time(),
    })
    if not saved then
        return false, "não foi possível salvar a configuração"
    end
    logger.info("studyreader: device paired with", server)
    return true
end

function Sync.listCourses()
    local config = Sync.loadConfig()
    if not config then return nil, "dispositivo não pareado" end
    local courses, err = request_json(config, "GET", API .. "/sync/courses")
    if not courses then return nil, err end
    if type(courses) ~= "table" then return {}, nil end
    return courses, nil
end

function Sync.downloadCourse(course_id)
    local config = Sync.loadConfig()
    if not config then return nil, "dispositivo não pareado" end

    local https, ltn12, unavailable = http_client()
    if not https then return nil, unavailable end

    local dir = Sync.coursesDir()
    if lfs.attributes(dir, "mode") ~= "directory" then
        lfs.mkdir(dir)
    end
    local dest = string.format("%s/%s.study", dir, course_id)

    local chunks = {}
    local ok, status = https.request({
        url = string.format("%s%s/sync/courses/%s/package", config.server, API, course_id),
        method = "GET",
        headers = { ["Authorization"] = "Bearer " .. config.token },
        sink = ltn12.sink.table(chunks),
    })
    if not ok then
        return nil, tostring(status)
    end
    if status ~= 200 then
        return nil, string.format("HTTP %s", tostring(status))
    end

    local file = io.open(dest, "wb")
    if not file then return nil, "não foi possível criar o arquivo" end
    for _, chunk in ipairs(chunks) do
        file:write(chunk)
    end
    file:close()
    return dest
end

function Sync.fetchState(course_id)
    local config = Sync.loadConfig()
    if not config then return nil, "dispositivo não pareado" end
    return request_json(
        config, "GET", string.format("%s/sync/courses/%s/state", API, course_id))
end

function Sync.pushState(course_id, state)
    local config = Sync.loadConfig()
    if not config then return nil, "dispositivo não pareado" end
    return request_json(
        config, "PUT", string.format("%s/sync/courses/%s/state", API, course_id), state)
end

function Sync.mergeState(local_state, remote_state)
    local remote = remote_state or {}
    local merged = { progress = {}, answers = {}, reviews = {} }

    local completed = {}
    for id, ts in pairs((local_state.progress or {}).completedLessons or {}) do
        completed[id] = ts
    end
    for id, ts in pairs((remote.progress or {}).completedLessons or {}) do
        if completed[id] == nil or tostring(ts or "") > tostring(completed[id] or "") then
            completed[id] = ts
        end
    end
    merged.progress.completedLessons = completed
    merged.progress.currentLesson = (remote.progress or {}).currentLesson
        or (local_state.progress or {}).currentLesson

    local answers = {}
    for id, record in pairs(local_state.answers or {}) do answers[id] = record end
    for id, record in pairs(remote.answers or {}) do
        local mine = answers[id]
        if mine == nil
            or tostring(record.answeredAt or "") >= tostring(mine.answeredAt or "") then
            answers[id] = record
        end
    end
    merged.answers = answers

    local reviews = {}
    for id, record in pairs(local_state.reviews or {}) do reviews[id] = record end
    for id, record in pairs(remote.reviews or {}) do
        local mine = reviews[id]
        if mine == nil
            or tostring(record.gradedAt or "") >= tostring(mine.gradedAt or "") then
            reviews[id] = record
        end
    end
    merged.reviews = reviews

    return merged
end

function Sync.syncCourse(course_id)
    local remote, err = Sync.fetchState(course_id)
    if not remote then return nil, err end

    local local_state = State.load(course_id)
    local merged = Sync.mergeState(local_state, remote)
    State.save(course_id, merged)

    local pushed, push_err = Sync.pushState(course_id, merged)
    if not pushed then return nil, push_err end
    return pushed
end

return Sync
