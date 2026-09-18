--[[-- SM-2 spaced repetition scheduler (self-contained, no external deps).]]

local SRS = {}

SRS.GRADES = { "Again", "Hard", "Good", "Easy" }
local GRADE_TO_QUALITY = { 2, 3, 4, 5 }

function SRS.newCard(now)
    return {
        reps = 0,
        lapses = 0,
        ef = 2.5,
        interval = 0,
        due = now or os.time(),
    }
end

function SRS.isDue(card, now)
    return (now or os.time()) >= (card.due or 0)
end

function SRS.grade(card, grade_index, now)
    local quality = GRADE_TO_QUALITY[grade_index] or 4
    now = now or os.time()
    if quality < 3 then
        card.lapses = (card.lapses or 0) + 1
        card.reps = 0
        card.interval = 0
        card.due = now + 600
        card.gradedAt = os.date("!%Y-%m-%dT%H:%M:%SZ", now)
        return card
    end
    card.reps = (card.reps or 0) + 1
    if card.reps == 1 then
        card.interval = 1
    elseif card.reps == 2 then
        card.interval = 6
    else
        card.interval = math.floor((card.interval or 6) * card.ef) + 1
    end
    local ef = card.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    card.ef = math.max(1.3, ef)
    card.due = now + card.interval * 86400
    card.gradedAt = os.date("!%Y-%m-%dT%H:%M:%SZ", now)
    return card
end

return SRS
