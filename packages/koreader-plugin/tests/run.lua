-- Standalone Lua tests for the plugin's pure modules (no KOReader required).
-- Run with: luajit tests/run.lua  (from packages/koreader-plugin)

local here = debug.getinfo(1, "S").source:match("@(.*/)") or ""
local plugin = here .. "../plugin/studyreader.koplugin/"

local failures = 0
local function check(name, fn)
	local ok, err = pcall(fn)
	if ok then
		print("  ok  " .. name)
	else
		failures = failures + 1
		print("FAIL  " .. name .. "\n      " .. tostring(err))
	end
end

dofile(plugin .. "srs.lua")
dofile(plugin .. "md2xhtml.lua")

local md2xhtml = dofile(plugin .. "md2xhtml.lua")
local SRS = dofile(plugin .. "srs.lua")
local ExamCore = dofile(plugin .. "examcore.lua")

check("md2xhtml renders headings, tables, quotes, directives", function()
	local md = table.concat({
		"# Título",
		"",
		"Parágrafo com **negrito** e *itálico* e `code`.",
		"",
		"## Seção",
		"",
		"| A | B |",
		"| - | - |",
		"| 1 | 2 |",
		"",
		"> Aviso importante",
		"",
		"{{quiz:q1}}",
		"",
		"{{image:assets/x.jpg}}",
		"",
		"- item 1",
		"- item 2",
		"",
		"```",
		"code block",
		"```",
	}, "\n")
	local out = md2xhtml.convert(md, "Teste")
	assert(out.xhtml:match("<h1"), "h1")
	assert(out.xhtml:match("<h2[^>]*>Seção</h2>"), "h2")
	assert(out.xhtml:match("<strong>negrito</strong>"), "bold")
	assert(out.xhtml:match("<em>itálico</em>"), "italic")
	assert(out.xhtml:match("<code>code</code>"), "inline code")
	assert(out.xhtml:match("<table"), "table")
	assert(out.xhtml:match("<th[^>]*>A</th>"), "th A")
	assert(out.xhtml:match("<blockquote"), "blockquote")
	assert(out.xhtml:match("Quiz"), "quiz marker")
	assert(out.xhtml:match('src="assets/x%.jpg"') or out.xhtml:match('src="assets/x.jpg"'), "image src")
	assert(out.xhtml:match("<li>item 1</li>"), "list item")
	assert(out.xhtml:match("<pre"), "code fence")
	assert(not out.xhtml:match("{{"), "no leaked directives")
	assert(#out.quizzes == 1 and out.quizzes[1] == "q1", "quiz ids")
	assert(#out.images == 1 and out.images[1] == "assets/x.jpg", "image ids")
end)

check("md2xhtml escapes XML", function()
	local out = md2xhtml.convert("a < b & c > d", "T")
	assert(out.xhtml:match("&lt;"), "lt")
	assert(out.xhtml:match("&amp;"), "amp")
end)

check("md2xhtml keeps escaped punctuation literal", function()
	local out = md2xhtml.convert("a \\_b\\_ c", "T")
	assert(out.xhtml:match("<p>a _b_ c</p>"), "literal underscores, got: "
		.. (out.xhtml:match("<p>a (.-)</p>") or "?"))
end)

check("srs schedules SM-2 intervals", function()
	local card = SRS.newCard(1000)
	assert(SRS.isDue(card, 1000))
	SRS.grade(card, 4, 1000)
	assert(card.interval == 1)
	SRS.grade(card, 4, 2000)
	assert(card.interval == 6)
	SRS.grade(card, 5, 3000)
	assert(card.interval >= 14)
	assert(not SRS.isDue(card, 4000))
	SRS.grade(card, 1, 4000)
	assert(card.due == 4600 and card.lapses == 1 and card.reps == 0)
end)

check("srs clamps easiness floor", function()
	local card = SRS.newCard(0)
	for _ = 1, 20 do
		SRS.grade(card, 3, 0)
	end
	assert(card.ef >= 1.3)
end)

check("main registers itself in the KOReader main menu", function()
	-- FileManagerMenu/ReaderMenu only call addToMainMenu() on widgets passed to
	-- menu:registerToMainMenu(), so init() must register the plugin.
	local stubs = {
		["dispatcher"] = { registerAction = function() end },
		["ui/uimanager"] = { scheduleIn = function() end },
		["logger"] = { dbg = function() end, info = function() end },
		["gettext"] = function(s) return s end,
		["screens"] = {},
		["state"] = {},
		["store"] = {},
		["datastorage"] = { getDataDir = function() return "/tmp" end },
		["json"] = {},
		["libs/libkoreader-lfs"] = {},
		["sync"] = { paired = function() return false end },
		["syncui"] = {},
		["ui/widget/container/widgetcontainer"] = {
			extend = function(base, o)
				o = o or {}
				o.new = function(cls, inst)
					inst = setmetatable(inst or {}, { __index = cls })
					if inst.init then inst:init() end
					return inst
				end
				return setmetatable(o, { __index = base })
			end,
		},
	}
	local saved = {}
	for name, mod in pairs(stubs) do
		saved[name] = package.loaded[name]
		package.loaded[name] = mod
	end
	local ok, err = pcall(function()
		local Plugin = dofile(plugin .. "main.lua")
		local registered = {}
		local ui = { menu = { registerToMainMenu = function(_, w) registered[#registered + 1] = w end } }
		local instance = Plugin:new{ ui = ui }
		assert(#registered == 1 and registered[1] == instance, "plugin not registered to main menu")
		local menu_items = {}
		instance:addToMainMenu(menu_items)
		local entry = menu_items.studyreader
		assert(entry and entry.text == "Study", "missing Study entry")
		local sub = entry.sub_item_table_func()
		assert(sub[1].text == "My courses" and sub[2].text == "Continue studying"
			and sub[3].text == "Reviews", "unexpected Study submenu")
	end)
	for name in pairs(stubs) do
		package.loaded[name] = saved[name]
	end
	assert(ok, err)
end)

check("state treats timestamped lessons as completed", function()
	local stubs = {
		["datastorage"] = { getDataDir = function() return "/tmp" end },
		["json"] = {},
		["logger"] = { warn = function() end },
		["libs/libkoreader-lfs"] = {},
	}
	local saved = {}
	for name, mod in pairs(stubs) do
		saved[name] = package.loaded[name]
		package.loaded[name] = mod
	end
	local ok, err = pcall(function()
		local State = dofile(plugin .. "state.lua")
		local state = { progress = {}, answers = {}, reviews = {} }
		assert(not State.completedLesson(state, "l1"), "fresh lesson completed")
		State.markLessonDone(state, "l1")
		assert(State.completedLesson(state, "l1"), "markLessonDone not seen as completed")
		state.progress.completedLessons.legacy = true
		assert(State.completedLesson(state, "legacy"), "legacy boolean entry")
		assert(not State.completedLesson(state, "l2"), "other lesson completed")
	end)
	for name in pairs(stubs) do
		package.loaded[name] = saved[name]
	end
	assert(ok, err)
end)

check("examcore samples without duplicates and clips count", function()
	math.randomseed(42)
	local ids = {}
	for i = 1, 100 do ids[i] = "q" .. i end
	local picked = ExamCore.sample(ids, 10)
	assert(#picked == 10, "count")
	local seen = {}
	for _, id in ipairs(picked) do
		assert(not seen[id], "duplicate " .. id)
		seen[id] = true
	end
	local all = ExamCore.sample(ids, 0)
	assert(#all == 100, "no count returns full bank")
end)

check("examcore grades all-or-nothing with 70% cutoff", function()
	local questions = {
		a = { correct = { "x" } },
		b = { correct = { "x", "y" } },
		c = { correct = { "z" } },
		d = { correct = { "x" } },
		e = { correct = { "x", "y" } },
		f = { correct = { "z" } },
		g = { correct = { "x" } },
		h = { correct = { "z" } },
		i = { correct = { "x" } },
		j = { correct = { "x" } },
	}
	local result = ExamCore.grade(questions, { "a", "b", "c" }, {
		a = { "x" },
		b = { "x", "z" },
	})
	assert(result.total == 3)
	assert(result.answered == 2, "answered")
	assert(result.correct == 1, "correct")
	assert(result.score == 33, "score")
	assert(not result.passed)
	local perfect = ExamCore.grade(questions, { "a", "b", "c" }, {
		a = { "x" },
		b = { "y", "x" },
		c = { "z" },
	})
	assert(perfect.correct == 3 and perfect.score == 100 and perfect.passed)
	local borderline = ExamCore.grade(questions,
		{ "a", "b", "c", "d", "e", "f", "g", "h", "i", "j" }, {
			a = { "x" }, b = { "x", "y" }, c = { "z" },
			d = { "x" }, e = { "x", "y" }, f = { "z" },
			g = { "x" }, h = { "wrong" },
		})
	assert(borderline.score == 70 and borderline.passed, "70 exact passes")
end)

check("examcore formats clock and duration", function()
	assert(ExamCore.formatClock(0) == "0:00")
	assert(ExamCore.formatClock(65) == "1:05")
	assert(ExamCore.formatClock(-5) == "0:00")
	assert(ExamCore.formatDuration(45) == "45s")
	assert(ExamCore.formatDuration(90) == "1m")
	assert(ExamCore.formatDuration(3700) == "1h01m")
end)

check("srs matches the shared SM-2 conformance vectors (TS parity)", function()
	local function decode_json(text)
		local pos = 1
		local parse_object, parse_array, parse_string, parse_number, parse_value

		local function skip_ws()
			while pos <= #text do
				local c = text:sub(pos, pos)
				if c == " " or c == "\t" or c == "\n" or c == "\r" then
					pos = pos + 1
				else
					break
				end
			end
		end

		function parse_string()
			pos = pos + 1
			local out = {}
			while pos <= #text do
				local c = text:sub(pos, pos)
				if c == '"' then
					pos = pos + 1
					return table.concat(out)
				elseif c == "\\" then
					local esc = text:sub(pos + 1, pos + 1)
					pos = pos + 2
					local map = { n = "\n", t = "\t", r = "\r", b = "\b", f = "\f", ['"'] = '"', ["\\"] = "\\", ["/"] = "/" }
					if map[esc] then
						out[#out + 1] = map[esc]
					elseif esc == "u" then
						local code = tonumber(text:sub(pos, pos + 3), 16)
						pos = pos + 4
						if code < 128 then
							out[#out + 1] = string.char(code)
						else
							out[#out + 1] = string.char(192 + math.floor(code / 64), 128 + code % 64)
						end
					else
						error("bad escape " .. esc)
					end
				else
					out[#out + 1] = c
					pos = pos + 1
				end
			end
			error("unterminated string")
		end

		function parse_number()
			local num = text:match("^%-?%d+%.?%d*[eE]?%d*", pos)
			if not num then error("bad number at " .. pos) end
			pos = pos + #num
			return tonumber(num)
		end

		function parse_array()
			pos = pos + 1
			local arr = {}
			skip_ws()
			if text:sub(pos, pos) == "]" then pos = pos + 1 return arr end
			while true do
				arr[#arr + 1] = parse_value()
				skip_ws()
				local c = text:sub(pos, pos)
				pos = pos + 1
				if c == "]" then return arr end
				assert(c == ",", "expected , in array")
			end
		end

		function parse_object()
			pos = pos + 1
			local obj = {}
			skip_ws()
			if text:sub(pos, pos) == "}" then pos = pos + 1 return obj end
			while true do
				skip_ws()
				local key = parse_string()
				skip_ws()
				assert(text:sub(pos, pos) == ":", "expected :")
				pos = pos + 1
				obj[key] = parse_value()
				skip_ws()
				local c = text:sub(pos, pos)
				pos = pos + 1
				if c == "}" then return obj end
				assert(c == ",", "expected , in object")
			end
		end

		function parse_value()
			skip_ws()
			local c = text:sub(pos, pos)
			if c == "{" then return parse_object() end
			if c == "[" then return parse_array() end
			if c == '"' then return parse_string() end
			if text:sub(pos, pos + 3) == "true" then pos = pos + 4 return true end
			if text:sub(pos, pos + 4) == "false" then pos = pos + 5 return false end
			if text:sub(pos, pos + 3) == "null" then pos = pos + 4 return nil end
			return parse_number()
		end

		return parse_value()
	end

	local path = here .. "../../srs/fixtures/vectors.json"
	local file = assert(io.open(path, "rb"), "cannot open " .. path)
	local vectors = decode_json(file:read("*all"))
	file:close()

	local grade_index = { again = 1, hard = 2, good = 3, easy = 4 }
	for _, case in ipairs(vectors.cases) do
		local got = SRS.grade(case.card, grade_index[case.grade], case.now)
		for _, field in ipairs({ "reps", "lapses", "ef", "interval", "due", "gradedAt" }) do
			assert(got[field] == case.expected[field],
				case.name .. ": " .. field .. " got " .. tostring(got[field])
				.. " want " .. tostring(case.expected[field]))
		end
	end
end)

check("sync merges state per-key last-write-wins (mirrors api merge)", function()
	local stubs = {
		["datastorage"] = { getDataDir = function() return "/tmp" end },
		["json"] = {},
		["logger"] = { warn = function() end, info = function() end, dbg = function() end },
		["libs/libkoreader-lfs"] = {},
		["ssl.https"] = {},
		["ltn12"] = {},
		["state"] = {
			load = function() return { progress = {}, answers = {}, reviews = {} } end,
			save = function() end,
		},
	}
	local saved = {}
	for name, mod in pairs(stubs) do
		saved[name] = package.loaded[name]
		package.loaded[name] = mod
	end
	local ok, err = pcall(function()
		local Sync = dofile(plugin .. "sync.lua")

		local local_state = {
			progress = {
				currentLesson = "l1",
				completedLessons = { l1 = "2026-01-01T10:00:00Z", l3 = "2026-03-01T10:00:00Z" },
			},
			answers = {
				q1 = { selected = { "a" }, correct = false, answeredAt = "2026-01-01T10:00:00Z" },
			},
			reviews = {
				legacy = { reps = 5, lapses = 0, ef = 2.5, interval = 30, due = 1780000000 },
			},
		}
		local remote_state = {
			progress = {
				currentLesson = nil,
				completedLessons = { l1 = "2026-05-01T10:00:00Z", l2 = "2026-05-02T10:00:00Z" },
			},
			answers = {
				q1 = { selected = { "b" }, correct = true, answeredAt = "2026-02-01T10:00:00Z" },
				q2 = { selected = { "c" }, correct = true, answeredAt = "2026-02-01T11:00:00Z" },
			},
			reviews = {
				legacy = { reps = 0, lapses = 1, ef = 2.5, interval = 0, due = 1770000000, gradedAt = "2026-02-01T10:00:00Z" },
			},
		}

		local merged = Sync.mergeState(local_state, remote_state)

		assert(merged.progress.completedLessons.l1 == "2026-05-01T10:00:00Z", "newest completedLessons wins")
		assert(merged.progress.completedLessons.l2 == "2026-05-02T10:00:00Z", "remote-only lesson kept")
		assert(merged.progress.completedLessons.l3 == "2026-03-01T10:00:00Z", "local-only lesson kept")
		assert(merged.progress.currentLesson == "l1", "nil remote keeps local currentLesson")
		assert(merged.answers.q1.correct == true, "newest answer wins")
		assert(merged.answers.q2 ~= nil, "remote-only answer kept")
		assert(merged.reviews.legacy.gradedAt == "2026-02-01T10:00:00Z", "gradedAt beats legacy-missing")
		assert(merged.reviews.legacy.reps == 0, "remote review record chosen")

		local flipped = Sync.mergeState(remote_state, local_state)
		assert(flipped.answers.q1.correct == true, "newest answer wins either side")
		assert(flipped.progress.currentLesson == "l1", "non-nil currentLesson wins either side")
	end)
	for name in pairs(stubs) do
		package.loaded[name] = saved[name]
	end
	assert(ok, err)
end)

if failures > 0 then
	print(string.format("\n%d failure(s)", failures))
	os.exit(1)
end
print("\nall plugin tests passed")
