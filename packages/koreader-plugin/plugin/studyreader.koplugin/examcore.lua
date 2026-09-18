--[[-- examcore: pure exam logic (no UI) — sampling, grading, passing score.

An exam session samples the course question bank (shuffled, stored as an id
list) and grades all-or-nothing per question (multi-choice requires the exact
set). Passing score defaults to 70% (AIF-C01 style).
]]

local ExamCore = {}

ExamCore.PASSING_SCORE = 70

function ExamCore.sample(ids, count)
    local pool = {}
    for i, id in ipairs(ids) do
        pool[i] = id
    end
    for i = #pool, 2, -1 do
        local j = math.random(i)
        pool[i], pool[j] = pool[j], pool[i]
    end
    if count and count > 0 and count < #pool then
        local picked = {}
        for i = 1, count do
            picked[i] = pool[i]
        end
        return picked
    end
    return pool
end

local function sameSet(a, b)
    if #a ~= #b then return false end
    local seen = {}
    for _, v in ipairs(a) do
        seen[v] = (seen[v] or 0) + 1
    end
    for _, v in ipairs(b) do
        if not seen[v] then return false end
        seen[v] = seen[v] - 1
        if seen[v] < 0 then return false end
    end
    return true
end

--- Grades a finished session.
--- @param questions table question bank (id → question)
--- @param ids array session question ids, in order
--- @param answers table id → array of selected option ids (may be nil)
--- @return table {total, answered, correct, score, passed, perQuestion = {id → correct}}
function ExamCore.grade(questions, ids, answers)
    local total = #ids
    local answered = 0
    local correct = 0
    local per_question = {}
    for _, id in ipairs(ids) do
        local selected = answers[id]
        local is_answered = type(selected) == "table" and #selected > 0
        local is_correct = false
        if is_answered then
            answered = answered + 1
            local question = questions[id]
            if question then
                is_correct = sameSet(selected, question.correct)
            end
        end
        per_question[id] = is_correct
        if is_correct then
            correct = correct + 1
        end
    end
    local score = total > 0 and math.floor(correct * 100 / total) or 0
    return {
        total = total,
        answered = answered,
        correct = correct,
        score = score,
        passed = score >= ExamCore.PASSING_SCORE,
        perQuestion = per_question,
    }
end

function ExamCore.formatClock(seconds)
    seconds = math.max(0, math.floor(seconds or 0))
    local m = math.floor(seconds / 60)
    local s = seconds % 60
    return string.format("%d:%02d", m, s)
end

function ExamCore.formatDuration(seconds)
    seconds = math.max(0, math.floor(seconds or 0))
    if seconds < 60 then
        return string.format("%ds", seconds)
    end
    local m = math.floor(seconds / 60)
    local h = math.floor(m / 60)
    if h > 0 then
        return string.format("%dh%02dm", h, m % 60)
    end
    return string.format("%dm", m)
end

return ExamCore
