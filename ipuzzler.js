function Clue(ipuzClue, direction) {
    this.direction = direction;
    if (ipuzClue) {
        this.text = ipuzClue.clue || "";
        this.number = ipuzClue.number || 0;
        this.enumeration = (ipuzClue.enumeration || "").replace(/ /g, ',');
        this.label = ipuzClue.label || this.number;
    }
    this.root = null;
    this.next = null;
    this.continuations = [];
    this.ranges = [];
    this.drawHtml = function ($list) {
        var html = `<li><a href="#"><label>${this.label}</label>${this.text}`;
        if (this.enumeration) html += ` <span class="clue-enumeration">(${this.enumeration})</span>`;
        html += '</a></li>';
        this.html = $(html);
        $list.append(this.html);
    }
    this.focusFirstInput = function () {
        var cells = this.ranges?.[0];
        var input = cells?.[0]?.input;
        if (input) input.focus();
    }
    this.focusFinalInput = function () {
        var cells = this.ranges?.[0];
        var input = cells?.[cells.length - 1]?.input;
        if (input) input.focus();
    }

    this.toString = function () {
        return (this.number + " " + this.direction);
    }
}

function Cell(input, $span, value, style = {}) {
    this.input = input; // HTMLInputElement
    this.$span = $span; // jQuery $<span /> for this cell
    this.value = value;
    this.style = style;
}

function iPuzzler(ipuz, $container) {

    const $grid = $('<div class="puzzle-grid"/>');
    const $info = $('<div class="puzzle-info" />');
    const $puzzle = $('<div class="puzzle-grid-wrapper"/>');
    $puzzle.append($grid);
    $puzzle.append($info);
    const $acrossListWrapper = $('<div class="clue-list-wrapper across-clue-list-wrapper"><h4>Across</h4><ul class="clue-list across-clue-list"></ul></div>');
    const $downListWrapper = $('<div class="clue-list-wrapper down-clue-list-wrapper"><h4>Down</h4><ul class="clue-list down-clue-list"></ul></div>');

    this.clues = { across: [], down: [] };
    this.cells = [];
    this.cluePositions = [];
    this.direction = "across";

    this.input = null;
    this.cell = null;
    this.clue = null;

    this.drawElements = function () {
        $container.html("");
        $container.append($grid);
        $container.append($acrossListWrapper);
        $container.append($downListWrapper);
    }

    this.ready = function () {
        puzzle.drawElements();
        puzzle.layoutPuzzleGrid();
        puzzle.drawPuzzle();
        puzzle.handleResize();

        // Because of the way the ipuz format handles continuations, we might end up
        // with down clues in the list of clues that came from ipuz.clues.Across
        let cluesFromAcross = puzzle.parseClues(ipuz.clues.Across, "across");
        let cluesFromDown = puzzle.parseClues(ipuz.clues.Down, "down");
        let allTheClues = cluesFromAcross.concat(cluesFromDown);
        for (const clue of allTheClues) puzzle.clues[clue.direction][clue.number] = clue;

        puzzle.attachRangesToClues();

        puzzle.drawClueList();

        $(window).resize(puzzle.handleResize);
        $grid.on("focus", "input", puzzle.inputFocus);
        $grid.on("keydown", "input", puzzle.inputKeyDown);
        $("ul.clue-list li").on("click", puzzle.clueListClick);
    }

    this.clueListClick = function (event) {
        $(".current-clue").removeClass("current-clue");
        var clue = puzzle.findClueForListItem(this);
        clue = (clue.root || clue);
        puzzle.highlightClue(clue);
        clue.ranges[0][0].input.focus();
    }

    this.changeDirection = (direction) => {
        if (direction) {
            this.direction = direction;
        } else if (this.direction == "across") {
            this.direction = "down";
        } else {
            this.direction = "across";
        }
        this.highlightClueForInput(this.input);
    }

    this.inputKeyDown = function (event) {
        console.log(event.key);
        let handler = puzzle.keyHandlers[event.key];
        if (handler) handler(this);
    }

    this.keyHandlers = {
        ArrowLeft: () => this.moveFocusToPreviousCell("across"),
        ArrowRight: () => this.moveFocusToNextCell("across"),
        ArrowUp: () => this.moveFocusToPreviousCell("down"),
        ArrowDown: () => this.moveFocusToNextCell("down"),
        Home: () => this.clue.focusFirstInput(),
        End: () => this.clue.focusFinalInput(),
        Backspace: () => { this.input.value = ""; this.moveFocusToPreviousCell() },
        Delete: () => this.input.value = ""
    }

    this.moveFocusToNextCell = function (direction = puzzle.direction) {
        var cell = puzzle.cell;
        if (cell.next && cell.next[direction]) {
            puzzle.changeDirection(direction);
            cell.next[direction].input.focus();
        } else {
            var clues = this.findCluesForInput(puzzle.input);
            var clue = clues.find(c => c.direction == direction);
            if (clue && clue.next) this.focusClue(clue.next);
        }
    }

    this.moveFocusToPreviousCell = function (direction = puzzle.direction) {
        var cell = puzzle.cell;
        if (cell.previous && cell.previous[direction]) {
            puzzle.changeDirection(direction);
            cell.previous[direction].input.focus();
        }
    }


    this.findCellForInput = input => puzzle.cells.flat().find(cell => cell.input == input);

    this.inputFocus = function (event) {
        const input = this;
        const clues = puzzle.findCluesForInput(input);
        if (event.type != "click" && clues.length > 1) {
            $(puzzle.input).off("click");
            window.setTimeout(() => $(input).on("click", event => puzzle.changeDirection()), 200);
        }
        puzzle.highlightClueForInput(input);
        puzzle.input = this;
        puzzle.cell = puzzle.findCellForInput(this);
        console.log(puzzle.cell);
    }

    this.highlightClueForInput = function (input) {
        $(".current-clue").removeClass("current-clue");
        const clues = puzzle.findCluesForInput(input);
        const clue = (clues.length > 1 ? clues.find(c => c.direction == puzzle.direction) : clues[0]);
        puzzle.direction = clue.direction;
        puzzle.clue = clue;
        puzzle.highlightClue(clue.root || clue);
    }

    this.focusClue = function (clue) {
        puzzle.changeDirection(clue.direction);
        clue.focusFirstInput();
    }

    this.highlightClue = function (clue) {
        clue.continuations.forEach(puzzle.highlightClue);
        clue.ranges.forEach(range => range.forEach(cell => cell.$span.addClass("current-clue")));
        clue.html.addClass("current-clue");
    }

    this.findClueForListItem = function (li) {
        let allClues = puzzle.clues.across.concat(puzzle.clues.down).filter(c => c);
        return allClues.find(clue => clue.html[0] == li);
    }

    this.findCluesForInput = function (inputElement) {
        let cellContainsInput = cell => cell.input == inputElement;
        let rangeContainsInput = cells => cells.some(cellContainsInput);
        let allClues = puzzle.clues.across.concat(puzzle.clues.down).filter(c => c);
        return allClues.filter(clue => clue.ranges.some(rangeContainsInput));
    }

    this.buildRange = function (x, y, direction, previous) {
        console.log(x, y, direction, previous);
        if (x < 0 || x >= puzzle.cells.length) return [];
        if (y < 0 || y >= puzzle.cells[x].length) return [];
        let cell = puzzle.cells[x][y];
        if (cell.value == "#") return [];
        if (previous) {
            if (direction == "across" && /L/i.test(cell.style.barred)) return [];
            if (direction == "down" && /T/i.test(cell.style.barred)) return [];
            cell.previous ||= {};
            cell.previous[direction] = previous;
            previous.next ||= {};
            previous.next[direction] = cell;
        }
        (direction == "across" ? x++ : y++);
        return ([cell].concat(this.buildRange(x, y, direction, cell)));
    }

    this.attachRangesToClues = function () {
        for (const clue of puzzle.clues.across.filter(c => c)) {
            var position = puzzle.cluePositions[clue.number];
            clue.ranges.push(this.buildRange(position.x, position.y, "across"));
        }
        for (const clue of puzzle.clues.down.filter(c => c)) {
            var position = puzzle.cluePositions[clue.number];
            clue.ranges.push(this.buildRange(position.x, position.y, "down"));
        }
    }

    this.drawClueList = function () {
        let $list = $acrossListWrapper.find("ul");
        puzzle.clues.across.map(clue => clue.drawHtml($list));
        $list = $downListWrapper.find("ul");
        puzzle.clues.down.map(clue => clue.drawHtml($list));
    }

    this.parseClues = function (ipuzClueList, direction) {
        const clues = ipuzClueList.map(c => [...this.parseClue(c, direction)]).flat();
        for (const clue of clues) {
            if (clue.continuations && clue.continuations.length) {
                clue.next = clue.continuations[0];
                for (let i = 0; i < clue.continuations.length - 1; i++) {
                    clue.continuations[i].next = clue.continuations[i + 1];
                }
            }
        }
        return clues;
    }

    this.parseClue = function* (ipuzClue, direction) {
        var clue = new Clue(ipuzClue, direction);
        if (ipuzClue.continued && typeof ipuzClue.continued[Symbol.iterator] === "function") {
            for (const continuation of ipuzClue.continued) {
                let cc = new Clue(continuation);
                cc.direction = continuation.direction.toLowerCase();
                cc.text = `See ${ipuzClue.number}`;
                cc.root = clue;
                clue.continuations.push(cc);
                yield cc;
            }
        }
        yield clue;
    }


    this.drawGridCell = function (x, y, ipuzData) {
        let $span = $("<span class='cell'></span>");
        if (ipuzData.style && ipuzData.style.barred) $span.addClass(`barred-${ipuzData.style.barred.toLowerCase()}`);
        let value = (ipuzData.cell || ipuzData);
        let input = null;
        let clueNumber = parseInt(value);
        if (clueNumber) {
            puzzle.cluePositions[clueNumber] = { x: x, y: y };
            $span.append(`<span class="clue-number">${clueNumber}</span>`);
        }
        if (value == "#") {
            $span.addClass("block");
        } else {
            let $input = $(`<input maxlength='1' data-x="${x}" data-y="${y}" value="" />`);
            $span.append($input);
            input = $input[0];
        }
        $grid.append($span);
        return new Cell(input, $span, value, ipuzData.style);
    }

    this.drawPuzzle = function () {
        ipuz.puzzle.forEach((row, y) => row.forEach((ipuzCell, x) => {
            if (!Array.isArray(puzzle.cells[x])) puzzle.cells[x] = new Array();
            puzzle.cells[x][y] = this.drawGridCell(x, y, ipuzCell);
        }));
    }

    this.layoutPuzzleGrid = function () {
        $grid.html("");
        let gridCss = { "grid-template": `repeat(${ipuz.dimensions.width}, 1fr) / repeat(${ipuz.dimensions.height}, 1fr)` }
        if ($(window).width() > 768) {
            gridCss.width = `${ipuz.dimensions.width * 32}px`;
            gridCss.height = `${ipuz.dimensions.height * 32}px`;
        }
        $grid.css(gridCss);
    }

    this.handleResize = function () {
        let gridSize = $grid.width();
        $grid.find("input").css("font-size", `${(Math.ceil(gridSize / (1.6 * ipuz.dimensions.height)))}px`);
        $grid.find("span.clue-number").css("font-size", `${(Math.ceil(gridSize / (3.5 * ipuz.dimensions.height)))}px`);
    }

    const puzzle = this;
    $(puzzle.ready);
}

