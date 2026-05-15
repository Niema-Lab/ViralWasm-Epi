#! /usr/bin/env python3
'''
Compile summary file(s)
'''

# imports
from glob import glob
from json import dump as jdump
from html import escape

# main program
if __name__ == "__main__":
    # create REFS.json
    REFS = dict()
    for fas in glob('*/*.fas'):
        ID = fas.split('/')[-2].strip()
        if ID in REFS:
            raise ValueError("Duplicate ID: %s" % ID)
        REFS[ID] = {
            'name': open('%s/%s.name.txt' % (ID,ID)).read().strip(),
            'shortname': [l.strip() for l in open('%s/%s.shortname.txt' % (ID,ID)).read().strip().splitlines()],
        }
    f = open('REFS.json', 'w'); jdump(REFS, f); f.close()

    # create index.html
    html = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reference Genomes - Niema Lab</title>
<style>
body { font-family: monospace; margin: 2rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: top; }
th { background: #f6f8fa; cursor: pointer; user-select: none; }
tr:nth-child(even) { background: #fafafa; }
.sort-arrow { margin-left: 0.4rem; }
</style>
<script>
function sortTable(columnIndex) {
    var table = document.getElementById("refs-table");
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    var headers = table.tHead.rows[0].cells;
    var currentColumn = table.getAttribute("data-sort-column");
    var currentDirection = table.getAttribute("data-sort-direction");
    var direction = "asc";
    if (currentColumn == columnIndex && currentDirection == "asc") {
        direction = "desc";
    }
    rows.sort(function(a, b) {
        var aText = a.cells[columnIndex].innerText.trim().toLowerCase();
        var bText = b.cells[columnIndex].innerText.trim().toLowerCase();
        if (aText < bText) return direction === "asc" ? -1 : 1;
        if (aText > bText) return direction === "asc" ? 1 : -1;
        return 0;
    });
    rows.forEach(function(row) {
        tbody.appendChild(row);
    });
    for (var i = 0; i < headers.length; i++) {
        var arrow = headers[i].querySelector(".sort-arrow");
        if (arrow) {
            arrow.innerText = "";
        }
    }
    var selectedArrow = headers[columnIndex].querySelector(".sort-arrow");
    selectedArrow.innerText = direction === "asc" ? "▲" : "▼";
    table.setAttribute("data-sort-column", columnIndex);
    table.setAttribute("data-sort-direction", direction);
}
window.onload = function() {
    sortTable(1);
};
</script>
</head>
<body>
<h1><a href="https://github.com/Niema-Lab/Reference-Genomes" target="_blank">Reference Genomes</a></h1>
<table id="refs-table">
<thead>
<tr>
<th onclick="sortTable(0)">ID<span class="sort-arrow"></span></th>
<th onclick="sortTable(1)">Name<span class="sort-arrow"></span></th>
<th onclick="sortTable(2)">Short Name(s)<span class="sort-arrow"></span></th>
</tr>
</thead>
<tbody>
'''
    for ID in sorted(REFS):
        html += '''<tr>
<td><a href="https://github.com/Niema-Lab/Reference-Genomes/tree/main/%s" target="_blank">%s</a></td>
<td>%s</td>
<td>%s</td>
</tr>
''' % (
            escape(ID),
            escape(ID),
            escape(REFS[ID]['name']),
            escape(', '.join(REFS[ID]['shortname']))
        )
    html += '''</tbody>
</table>
</body>
<footer>
<p style="text-align: center;"><a href="https://niema.net" target="_blank">Niema Moshiri</a></p>
</footer>
</html>
'''

    f = open('index.html', 'w'); f.write(html); f.close()
