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

if failures > 0 then
	print(string.format("\n%d failure(s)", failures))
	os.exit(1)
end
print("\nall plugin tests passed")
