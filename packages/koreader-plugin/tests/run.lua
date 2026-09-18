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

if failures > 0 then
	print(string.format("\n%d failure(s)", failures))
	os.exit(1)
end
print("\nall plugin tests passed")
