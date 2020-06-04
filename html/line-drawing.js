const scale = 22;



function genMap(width, height) {
    let m = [];
    for (let i = 0; i < width; i++) {
        let row = []
        for (let j = 0; j < height; j++) {
            let ran = Math.floor(10 * Math.random());
            let v = ran > 8 ? 1 : 0
            row.push(v);
        }
        m.push(row);
    }
    return m;
}
function getObstacles(m) {
    let points = [];
    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j < m[0].length; j++) {
            if (m[i][j] > 0) {
                points.push({ x: i, y: j })
            }
        }
    }
    return points;
}

function clamp(x, lo, hi) {
    if (x < lo) {
        x = lo;
    }
    if (x > hi) {
        x = hi;
    }
    return x;
}
function lerp(start, end, t) {
    return start + t * (end - start);
}
function lerpPoint(P, Q, t) {
    return {
        x: lerp(P.x, Q.x, t),
        y: lerp(P.y, Q.y, t)
    }
}
function interpolationPoints(P, Q, N) {
    let points = [];
    for (let i = 0; i <= N; i++) {
        let t = N == 0 ? 0 : i / N;
        points.push(lerpPoint(P, Q, t))
    }
    return points;
}
function roundPoint(P) {
    return { x: Math.round(P.x), y: Math.round(P.y) };
}

function lineDistance(A, B) {
    return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y));
}
function eDistache(A, B) {
    return Math.abs(A.x - B.x) + Math.abs(A.y - B.y);
}

class Diagram {
    constructor(containerId, wi, hi) {
        this.root = d3.select(`#${containerId}`);
        this.A = { x: 2, y: 2 };
        this.B = { x: 20, y: 8 };
        this.m = genMap(wi, hi);
        this.parent = this.root.select("svg");
        this.vset = [];
        this.aStarPath=[];
        this._updateFunctions = [];
    }

    onUpdate(f) {
        this._updateFunctions.push(f);
        this.update();
    }
    update() {
        this._updateFunctions.forEach((f) => f());
    }

    addGrid() {
        let g = this.parent.append('g').attr('class', "grid");
        for (let x = 0; x < this.m.length; x++) {
            for (let y = 0; y < this.m[0].length; y++) {
                g.append('rect')
                    .attr('transform', `translate(${x * scale},${y * scale})`)
                    .attr('width', scale)
                    .attr('height', scale);
            }
        }
        return this;
    }
    addTrack() {
        let g = this.parent.append('g').attr('class', "track");
        let line = g.append('line');
        this.onUpdate(() => {
            line.attr('x1', (this.A.x + 0.5) * scale)
                .attr('y1', (this.A.y + 0.5) * scale)
                .attr('x2', (this.B.x + 0.5) * scale)
                .attr('y2', (this.B.y + 0.5) * scale)
        });
        return this;
    }

    addLerpValues() {
        this.t = 0.3;
        this.makeScrubbaleNumber('t', 0.0, 1.0, 2);
        this.onUpdate(() => {
            let t = this.t;
            function set(id, fmt, lo, hi) {
                d3.select(id).text(d3.format(fmt)(lerp(lo, hi, t)));
            }
            set("#lerp1", ".2f", 0, 1);
            set("#lerp2", ".0f", 0, 100);
            set("#lerp3", ".1f", 3, 5);
            set("#lerp4", ".1f", 5, 3);
        });
        return this;
    }

    addInterpolated(t, N, radius) {
        this.t = t;
        this.N = N;
        this.makeScrubbaleNumber('t', 0.0, 1.0, 2);
        this.makeScrubbaleNumber('N', 1, 30, 0);
        let g = this.parent.append('g').attr('class', "interpolated");
        this.onUpdate(() => {
            let points = this.t != null ? [lerpPoint(this.A, this.B, this.t)]
                : this.N != null ? interpolationPoints(this.A, this.B, this.N)
                    : [];
            let circles = g.selectAll("circle").data(points);
            circles.exit().remove();
            circles.enter().append('circle')
                .attr('r', radius)
                .merge(circles)
                .attr('transform', (p) => `translate(${(p.x + 0.5) * scale}, ${(p.y + 0.5) * scale})`);
        });
        return this;
    }

    addInterpolationLabels() {
        let g = this.parent.append('g').attr('class', "interpolation-labels");
        this.onUpdate(() => {
            let points = interpolationPoints(this.A, this.B, this.N);
            var offset = Math.abs(this.B.y - this.A.y)
                > Math.abs(this.B.x - this.A.x)
                ? { x: 0.8 * scale, y: 0 } : { x: 0, y: -0.8 * scale };
            let labels = g.selectAll("text").data(points);
            labels.exit().remove();
            labels.enter().append('text')
                .attr('text-anchor', 'middle')
                .text((p, i) => i)
                .merge(labels)
                .attr('transform',
                    (p) => `translate(${p.x * scale}, ${p.y * scale})
                            translate(${offset.x}, ${offset.y})
                            translate(${0.5 * scale}, ${0.75 * scale})`)
        });
        return this;
    }
    addLine() {
        let g = this.parent.append('g').attr('class', 'rounded');
        this.onUpdate(() => {
            let N = this.N == null ? lineDistance(this.A, this.B) : this.N;
            let points = interpolationPoints(this.A, this.B, N).map(roundPoint);
            let squares = g.selectAll("rect").data(points);
            squares.exit().remove();
            squares.enter().append('rect')
                .attr('width', scale)
                .attr('height', scale)
                .merge(squares)
                .attr('transform', (p) => `translate(${p.x * scale}, ${p.y * scale})`);
        });
        return this;
    }

    addHandles() {
        let g = this.parent.append('g').attr('class', "handles");
        this.makeDraggableCircle(g, this.A);
        this.makeDraggableCircle(g, this.B);
        return this;
    }

    addRect() {
        let g = this.parent.append('g').attr('class', 'obstacles');
        this.onUpdate(() => {
            let points = getObstacles(this.m);
            let squares = g.selectAll("rect").data(points);
            squares.exit().remove();
            squares.enter().append('rect')
                .attr('width', scale - 1)
                .attr('height', scale - 1)
                .merge(squares)
                .attr('transform', (p) => `translate(${p.x * scale}, ${p.y * scale})`);
        });
        return this;
    }
    addVisitedRect() {
        let g = this.parent.append('g').attr('class', 'visited');
        this.onUpdate(() => {
            let points = this.vset;
            let squares = g.selectAll("rect").data(points);
            squares.exit().remove();
            squares.enter().append('rect')
                .attr('width', scale - 3)
                .attr('height', scale - 3)
                .merge(squares)
                .attr('transform', (p) => `translate(${p.x * scale}, ${p.y * scale})`);
        });
        return this;
    }
    drawPath(){
        let g = this.parent.append('g').attr('class', 'path');
        this.onUpdate(()=>{
            let points = this.aStarPath;
            let squares = g.selectAll("rect").data(points);
            squares.exit().remove();
            squares.enter().append('rect')
                .attr('width', scale - 4)
                .attr('height', scale - 4)
                .merge(squares)
                .attr('transform', (p) => `translate(${p.x * scale}, ${p.y * scale})`);
        });
       return this;
    }
   

    addPath() {
        this.onUpdate(()=>{
            let start = this.A;
            let end = this.B;
            let m = this.m;
            this.aStarPath=[];
            let frontier = new PriorityQueue();
            frontier.enqueue(start, 0);
            let direct1 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            let direct2 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            let directions = direct1;
            let visitSet = [];
            let came_from = {};
            let cost_so_far = {};
            came_from[start.x + " " + start.y] = NaN;
            cost_so_far[start.x + " " + start.y] = 0;
            let find = false;
            while (!frontier.isEmpty()) {
                let current = frontier.dequeue().element;
                if (current.x == end.x && current.y == end.y|| m[current.x][current.y]>0||m[end.x][end.y]>0) {
                    break;
                }
    
                for (let i = 0; i < directions.length; i++) {
                    let direction = directions[i];
                    let cost = 10;
                    if (direction[0] != 0 && direction[1] != 0) {
                        cost = 14;
                    }
                    let x = current.x + direction[0];
                    let y = current.y + direction[1];
                    let cur = { x: x, y: y };
                    if (x < 0 || y < 0 || x >= m.length || y >= m[0].length || m[x][y] > 0) {
                        continue;
                    }
    
                    let new_cost = cost_so_far[current.x + " " + current.y] + cost;
                    if (!cost_so_far.hasOwnProperty(cur.x + " " + cur.y) || cost_so_far[cur.x + " " + cur.y] > new_cost) {
                        cost_so_far[cur.x + " " + cur.y] = new_cost;
                        let expect = eDistache(cur, end) * 10
                        frontier.enqueue(cur, new_cost + expect);
                        came_from[cur.x + " " + cur.y] = current;
                        if (!visitSet.hasOwnProperty(cur.x + " " + cur.y)) {
                            visitSet.push({ x: x, y: y })
                        }
                        if (cur.x == this.B.x && cur.y == this.B.y) {
                            find = true;
                            let temp = cur;
                          
                            while(temp.x != start.x || temp.y != start.y){
                                this.aStarPath.push(temp);
                                temp=came_from[temp.x+" "+ temp.y];
                            }
                            break;
                        }
    
                    }
                }
                
                if (find) {
                    break;
                }
    
            }
            this.vset = visitSet;
            // this.aStarPath = path;
        });
       return this;
    };
    /* 
        update() {
            let rects = this.gPoints.selectAll('rect')
                .data(pointsOnLine(this.A, this.B));
            rects.exit().remove();
            rects.enter().append('rect')
                .attr('width', scale - 1)
                .attr('height', scale - 1)
                .attr('fill', "hsl(0, 40%, 70%)")
                .merge(rects)
                .attr('transform', (p) => `translate(${p.x * scale}, ${p.y * scale})`);
    
            let t = this.t;
            function set(id, fmt, lo, hi) {
                d3.select(id).text(d3.format(fmt)(lerp(lo, hi, t)));
            }
            set("#lerp1", ".2f", 0, 1);
            set("#lerp2", ".0f", 0, 100);
            set("#lerp3", ".1f", 3, 5);
            set("#lerp4", ".1f", 5, 3);
        }
    
        drawGrid() {
            for (let x = 0; x < 25; x++) {
                for (let y = 0; y < 10; y++) {
                    this.gGrid.append('rect')
                        .attr('transform', `translate(${x * scale},${y * scale})`)
                        .attr('width', scale)
                        .attr('height', scale)
                        .attr('fill', "white")
                        .attr('stroke', "gray");
                }
            }
        } */

    makeDraggableCircle(parent, point) {
        let diagram = this;
        let circle = parent.append('g')
            .attr('class', "draggable")
            .call(d3.drag().on('drag', onDrag));
        circle.append('circle')
            .attr('class', "visible")
            .attr('r', 20);
        circle.append('circle')
            .attr('class', "visible")
            .attr('r', 6.5);

        function updatePosition() {
            circle.attr('transform', `translate(${(point.x + 0.5) * scale}  ${(point.y + 0.5) * scale})`);
        }

        function onDrag() {
            point.x = clamp(Math.floor(d3.event.x / scale), 0, 29);
            point.y = clamp(Math.floor(d3.event.y / scale), 0, 9);
            updatePosition();
            diagram.update();
        }
        updatePosition();
    }

    makeScrubbaleNumber(name, low, high, precision) {
        let diagram = this;
        let elements = diagram.root.selectAll(`[data-name='${name}']`);
        let positionToValue = d3.scaleLinear()
            .clamp(true)
            .domain([-100, +100])
            .range([low, high]);
        let formatter = d3.format(`.${precision}f`);

        function updateNumbers() {
            elements.text(formatter(diagram[name]));
        }

        updateNumbers();

        elements.call(d3.drag()
            .subject(() => ({ x: positionToValue.invert(diagram[name]), y: 0 }))
            .on('drag', () => {
                diagram[name] = parseFloat(formatter(positionToValue(d3.event.x)));
                updateNumbers();
                diagram.update();
            }));
    }

}

function PriorityQueue() {
    let items = [];
    function QueueElement(element, priority) {
        this.element = element;
        this.priority = priority;
    }
    this.enqueue = function (element, priority) {
        let qe = new QueueElement(element, -Math.abs(priority));
        let added = false;
        for (let i = 0; i < items.length; i++) {
            if (qe.priority > items[i].priority) {
                items.splice(i, 0, qe);
                added = true;
                break;
            }
        }
        if (!added) {
            items.push(qe);
        }
    }
    this.dequeue = () => {
        return items.shift();
    }
    this.front = () => {
        return items[0];
    }
    this.rear = () => {
        return items[items.length - 1];
    }
    this.isEmpty = () => {
        return items.length == 0;
    }
    this.size = () => { return items.length; }
    this.print = function () {
        for (let i = 0; i < items.length; i++) {
            console.log(`${items[i].element} - ${items[i].priority}`);
        }
    }
}

function sleep(d) {
    let n = Date.now();
    while (Date.now() < n + d);
}


/* let diagram1 = new Diagram('demo')
    .addGrid()
    .addLine()
    .addHandles();
let diagram2 = new Diagram('linear-interpolation')
    .addLerpValues();

let diagram3 = new Diagram('interpolate-t')
    .addGrid()
    .addTrack()
    .addInterpolated(0.5, null, 4)
    .addHandles();
 */

let diagram4 = new Diagram('demo', 30, 10)
    .addGrid()
    .addPath()
    .addVisitedRect()
    .addRect()
    .drawPath()
    .addTrack()
    .addInterpolated(null, 5, 2.5)
    .addHandles()
    .addInterpolationLabels();

/* let diagram5 = new Diagram('snap-to-grid')
    .addGrid()
    .addTrack()
    .addLine()
    .addInterpolated(null, 5, 2.5)
    .addHandles();

diagram5.onUpdate(() => {
    let distance = lineDistance(diagram5.A, diagram5.B);
    diagram5.root.selectAll(".optimal-N")
        .text(distance);
}); */

