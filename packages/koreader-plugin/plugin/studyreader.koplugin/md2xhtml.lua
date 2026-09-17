--[[-- Markdown (CommonMark/GFM subset) → standalone XHTML for crengine.

Supports the subset emitted by mdx-to-study: ATX headings, bold/italic/code
inline, fenced code blocks, blockquotes (callouts), pipe tables, bullet and
ordered lists, and the .study block directives {{quiz:id}}, {{flashcard:id}}
and {{image:path}} — rendered as visible markers, since interactivity lives
in the plugin's own quiz/review widgets.
]]

local md2xhtml = {}

local function escapeXml(text)
    return (text:gsub("&", "&amp;")
        :gsub("<", "&lt;")
        :gsub(">", "&gt;")
        :gsub('"', "&quot;"))
end

local XML_ESCAPED = {
    ["&"] = "&amp;",
    ["<"] = "&lt;",
    [">"] = "&gt;",
    ['"'] = "&quot;",
}

local function maskEscapes(text)
    return (text:gsub("\\(%p)", function(c)
        return string.format("\001%02x\002", string.byte(c))
    end))
end

local function unmaskEscapes(text)
    return (text:gsub("\001(%x%x)\002", function(hex)
        local c = string.char(tonumber(hex, 16))
        return XML_ESCAPED[c] or c
    end))
end

local function inlineFormat(text)
    text = maskEscapes(text)
    text = escapeXml(text)
    text = text:gsub("%*%*(.-)%*%*", "<strong>%1</strong>")
    text = text:gsub("%*(.-)%*", "<em>%1</em>")
    text = text:gsub("_(.-)_", "<em>%1</em>")
    text = text:gsub("`([^`]+)`", "<code>%1</code>")
    text = text:gsub("%[([^%]]+)%]%(([^)]+)%)",
        '<a href="%2">%1</a>')
    return unmaskEscapes(text)
end

local function isBlank(line)
    return line:match("^%s*$") ~= nil
end

local function splitBlocks(markdown)
    local blocks = {}
    local current = {}
    local in_fence = false
    for line in markdown:gmatch("([^\n]*)\n?") do
        if line:match("^%s*```") then
            in_fence = not in_fence
            current[#current + 1] = line
        elseif in_fence then
            current[#current + 1] = line
        elseif isBlank(line) then
            if #current > 0 then
                blocks[#blocks + 1] = current
                current = {}
            end
        else
            current[#current + 1] = line
        end
    end
    if #current > 0 then
        blocks[#blocks + 1] = current
    end
    return blocks
end

local function directiveOf(block)
    if #block == 1 then
        local kind, ref = block[1]:match("^%s*{{(%a+):([^}]+)}}%s*$")
        if kind == "quiz" or kind == "flashcard" or kind == "image" then
            return { kind = kind, ref = ref:match("^%s*(.-)%s*$") }
        end
    end
    return nil
end

local function renderTable(block, out)
    local rows = {}
    for _, line in ipairs(block) do
        local cells = {}
        for cell in line:gmatch("|([^|]*)") do
            cells[#cells + 1] = cell
        end
        if #cells > 0 then
            cells[#cells] = nil
            rows[#rows + 1] = cells
        end
    end
    if #rows < 2 then return false end
    local separator = table.concat(block, "\n"):match("|[%s:-]*|")
    if not separator then return false end
    table.remove(rows, 2)
    out[#out + 1] = '<table style="border-collapse:collapse;margin:0.4em 0">'
    for r, cells in ipairs(rows) do
        out[#out + 1] = "<tr>"
        for _, cell in ipairs(cells) do
            local tag = r == 1 and "th" or "td"
            out[#out + 1] = string.format(
                '<%s style="border:1px solid #888;padding:0.2em 0.5em;text-align:left">%s</%s>',
                tag, inlineFormat(cell:match("^%s*(.-)%s*$") or ""), tag)
        end
        out[#out + 1] = "</tr>"
    end
    out[#out + 1] = "</table>"
    return true
end

local function renderList(block, out)
    local items = {}
    local ordered = block[1]:match("^%s*%d+%.%s") ~= nil
    for _, line in ipairs(block) do
        local bullet = line:match("^%s*[-*]%s+(.*)$")
            or line:match("^%s*%d+%.%s+(.*)$")
        if bullet then
            items[#items + 1] = "<li>" .. inlineFormat(bullet) .. "</li>"
        elseif items[#items] then
            items[#items] = items[#items]:gsub(
                "</li>$", "<br/>" .. inlineFormat(line) .. "</li>")
        end
    end
    local tag = ordered and "ol" or "ul"
    out[#out + 1] = string.format('<%s style="margin:0.4em 0 0.4em 1.2em">', tag)
    for _, item in ipairs(items) do out[#out + 1] = item end
    out[#out + 1] = "</" .. tag .. ">"
end

function md2xhtml.parseDirectives(markdown)
    local result = { quizzes = {}, flashcards = {}, images = {} }
    for block in markdown:gmatch("([^\n]+\n?)") do
        local kind, ref = block:match("^%s*{{(%a+):([^}]+)}}%s*$")
        if kind == "quiz" then
            result.quizzes[#result.quizzes + 1] = ref
        elseif kind == "flashcard" then
            result.flashcards[#result.flashcards + 1] = ref
        elseif kind == "image" then
            result.images[#result.images + 1] = ref
        end
    end
    return result
end

local DIRECTIVE_STYLE = "color:#555;background-color:#eee;padding:0.3em 0.6em;display:block;margin:0.6em 0"

function md2xhtml.convert(markdown, title)
    local body = {}
    for _, block in ipairs(splitBlocks(markdown)) do
        local directive = directiveOf(block)
        if directive then
            if directive.kind == "quiz" then
                body[#body + 1] = string.format(
                    '<div style="%s">&#9670; Quiz — answer it from the Study menu</div>',
                    DIRECTIVE_STYLE)
            elseif directive.kind == "flashcard" then
                body[#body + 1] = string.format(
                    '<div style="%s">&#9670; Flashcard — review it from the Study menu</div>',
                    DIRECTIVE_STYLE)
            else
                body[#body + 1] = string.format(
                    '<div style="text-align:center"><img src="%s" alt="image" style="max-width:95%%"/></div>',
                    escapeXml(directive.ref))
            end
        elseif block[1]:match("^%s*```") then
            local code = {}
            for i = 2, #block - 1 do code[#code + 1] = block[i] end
            body[#body + 1] = string.format(
                '<pre style="background-color:#f0f0f0;padding:0.5em;font-size:0.85em"><code>%s</code></pre>',
                escapeXml(table.concat(code, "\n")))
        elseif block[1]:match("^%s*(#+)%s+") then
            local _, _, marks, text = block[1]:find("^%s*(#+)%s+(.+)$")
            local level = math.min(#marks, 6)
            body[#body + 1] = string.format(
                '<h%d style="margin:0.8em 0 0.3em 0">%s</h%d>',
                level, inlineFormat(text), level)
        elseif block[1]:match("^%s*>") then
            local quote = {}
            for _, line in ipairs(block) do
                quote[#quote + 1] = line:gsub("^%s*>%s?", "")
            end
            body[#body + 1] = string.format(
                '<blockquote style="margin:0.5em 0 0.5em 0.8em;padding-left:0.6em;border-left:3px solid #999;color:#222">%s</blockquote>',
                inlineFormat(table.concat(quote, " ")))
        elseif block[1]:match("^%s*|") and renderTable(block, body) then
            -- rendered by renderTable
        elseif block[1]:match("^%s*[-*]%s") or block[1]:match("^%s*%d+%.%s") then
            renderList(block, body)
        elseif block[1]:match("^%s*---+%s*$") then
            body[#body + 1] = '<hr style="border:none;border-top:1px solid #bbb"/>'
        else
            local paragraph = {}
            for _, line in ipairs(block) do
                paragraph[#paragraph + 1] = line
            end
            body[#body + 1] = "<p>"
                .. inlineFormat(table.concat(paragraph, " "))
                .. "</p>"
        end
    end

    return {
        xhtml = table.concat({
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!DOCTYPE html>',
            '<html xmlns="http://www.w3.org/1999/xhtml">',
            "<head>",
            '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>',
            "<title>" .. escapeXml(title or "Lesson") .. "</title>",
            '<style type="text/css">',
            "body { margin: 0.2em 0.3em; line-height: 1.35 }",
            "p { margin: 0.35em 0; text-indent: 0 }",
            "</style>",
            "</head>",
            "<body>",
            table.concat(body, "\n"),
            "</body>",
            "</html>",
        }, "\n"),
        quizzes = md2xhtml.parseDirectives(markdown).quizzes,
        flashcards = md2xhtml.parseDirectives(markdown).flashcards,
        images = md2xhtml.parseDirectives(markdown).images,
    }
end

return md2xhtml
