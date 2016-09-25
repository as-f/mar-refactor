// Make sure Math.random isn't used accidentally
Math.random = undefined;

//========================================
//                              DIRECTIONS

// direction names are based on clock directions
const DIR1  = { dx: 1, dy:-1, dz: 0 };
const DIR3  = { dx: 1, dy: 0, dz:-1 };
const DIR5  = { dx: 0, dy: 1, dz:-1 };
const DIR7  = { dx:-1, dy: 1, dz: 0 };
const DIR9  = { dx:-1, dy: 0, dz: 1 };
const DIR11 = { dx: 0, dy:-1, dz: 1 };

DIR1.clockwise = DIR3;
DIR3.clockwise = DIR5;
DIR5.clockwise = DIR7;
DIR7.clockwise = DIR9;
DIR9.clockwise = DIR11;
DIR11.clockwise = DIR1;

DIR1.counterclockwise = DIR11;
DIR11.counterclockwise = DIR9;
DIR9.counterclockwise = DIR7;
DIR7.counterclockwise = DIR5;
DIR5.counterclockwise = DIR3;
DIR3.counterclockwise = DIR1;

const directions = {DIR1, DIR3, DIR5, DIR7, DIR9, DIR11};

//========================================
//                                     FOV

/// Calculates field of view using radial recursive shadowcasting
///
/// ox {number} x coordinate of origin
/// oy {number} y coordinate of origin
/// transparent {function(x, y, radius)} whether the tile at (x, y) is transparent
///     x {number} x coordinate of tile
///     y {number} y coordinate of tile
///     radius {number} distance from tile to origin
/// reveal {function(x, y, radius)} called for each tile that is within the fov
///     same parameters as transparent above
const fov = (() => {
    // round a number, but round down in case of x.5
    const roundTieDown = n => Math.ceil(n - 0.5);

    // displacement vector for moving tangent to a circle counterclockwise in a certain sector
    const tangent = [
        { x: 0, y:-1 }, //  \
        { x:-1, y: 0 }, //  -
        { x:-1, y: 1 }, //  /
        { x: 0, y: 1 }, //  \
        { x: 1, y: 0 }, //  -
        { x: 1, y:-1 }, //  /
        { x: 0, y:-1 }, //  \
    ];

    // displacement vector for moving normal to a circle outward in a certain sector
    const normal = [
        { x: 1, y: 0 }, // -
        { x: 1, y:-1 }, // /
        { x: 0, y:-1 }, // \
        { x:-1, y: 0 }, // -
        { x:-1, y: 1 }, // /
        { x: 0, y: 1 }, // \
        { x: 1, y: 0 }, // -
    ];

    return (ox, oy, transparent, reveal) => {

        const revealWall = (x, y, radius) => {
            if (!transparent(x, y, radius)) {
                reveal(x, y, radius);
            }
        };

        // reveal the origin and surrounding 6 tiles
        reveal(ox, oy, 0);
        for (const key in directions) {
            const {dx, dy} = directions[key];
            revealWall(ox + dx, oy + dy, 1);
        }

        const polar2rect = (radius, angle) => {
            const sector = Math.floor(angle);
            const arc = roundTieDown((angle - sector) * (radius - 0.5));
            return {
                x: ox + radius * normal[sector].x + arc * tangent[sector].x,
                y: oy + radius * normal[sector].y + arc * tangent[sector].y,
                arc: radius * sector + arc,
            };
        };

        // reveal one arc of tiles
        // start and end are angles expressed from 0 to 6
        const scan = (radius, start, end) => {
            let someRevealed = false;
            let {x, y, arc} = polar2rect(radius, start);
            let current = start;
            while (current < end) {
                if (transparent(x, y, radius)) {
                    current = arc / radius;
                    if (current >= start && current <= end) {
                        reveal(x, y, radius);
                        someRevealed = true;
                        if (current >= 0 && current <= 2) { revealWall(x + 1, y - 1, radius + 1); }
                        if (current >= 1 && current <= 3) { revealWall(x    , y - 1, radius + 1); }
                        if (current >= 2 && current <= 4) { revealWall(x - 1, y    , radius + 1); }
                        if (current >= 3 && current <= 5) { revealWall(x - 1, y + 1, radius + 1); }
                        if (current >= 4 && current <= 6) { revealWall(x    , y + 1, radius + 1); }
                        if (current <= 1 || current >= 5) { revealWall(x + 1, y    , radius + 1); }
                    }
                } else {
                    current = (arc + 0.5) / radius;
                    if (someRevealed) {
                        scan(radius + 1, start, (arc - 0.5) / radius);
                    }
                    start = current;
                }
                // increment everything
                const displacement = tangent[Math.floor(arc / radius)];
                x += displacement.x;
                y += displacement.y;
                arc++;
            }
            if (someRevealed) {
                scan(radius + 1, start, end);
            }
        };
        scan(1, 0, 6);
    };
})();

//========================================
//                             PATHFINDING

// Calculate an influence map (aka flow map/Dijkstra map)
// this funtion assumes that nodes have their distance set already, noromally end nodes to 0 and all others to Infinity
const influenceMap = (nodes, forEachNeighbor, getDistance, setDistance, getCost, getVisited, setVisited) => {
    const unvisited = new Heap((a, b) => getDistance(a) - getDistance(b));

    nodes.forEach((node) => {
        unvisited.push(node);
    });

    while (!unvisited.empty()) {
        const node = unvisited.pop();
        setVisited(node, true);

        forEachNeighbor(node, (neighbor) => {
            const altDistance = getDistance(node) + getCost(neighbor);
            if (!getVisited(neighbor) && altDistance < getDistance(neighbor)) {
                setDistance(neighbor, altDistance);
                unvisited.updateItem(neighbor);
            }
        });
    }
};

//========================================
//                                     RNG

// generate a random integer in the interval [min, max]
const randInt = (min, max, prng) => {
    if (min > max) {
        console.error('randInt: min > max');
        return NaN;
    }
    return min + ((max - min + 1) * prng()) << 0;
};

// pick a random element of an array or object
const randElement = (object, prng) => {
    const keys = Object.keys(object);
    return object[keys[randInt(0, object.length - 1, prng)]];
};

//========================================
//                                HEX GRID

// call fun(x, y) for each tile
const forEachTileOfLevel = (width, height, fun) => {
    for (let y = 0; y < height; y++) {
        for (let x = Math.floor((height - y) / 2); x < width - Math.floor(y / 2); x++) {
            fun(x, y);
        }
    }
};

// call fun(x, y) for each tile except the outer edge
const forEachInnerTileOfLevel = (width, height, fun) => {
    for (let y = 1; y < height - 1; y++) {
        for (let x = Math.floor((height - y) / 2) + 1; x < width - Math.floor(y / 2) - 1; x++) {
            fun(x, y);
        }
    }
};

// whether a tile at (x, y) is in the level
const inBoundsOfLevel = (width, height, x, y) => {
    return y >= 0 &&
           y < height &&
           x >= Math.floor((height - y) / 2) &&
           x < width - Math.floor(y / 2);
};

// whether a tile at (x, y) is in the level and not on the outer edge
const inInnerBoundsOfLevel = (width, height, x, y) => {
    return y > 0 &&
           y < height - 1 &&
           x > Math.floor((height - y) / 2) &&
           x < width - Math.floor(y / 2) - 1;
};

// whether a tile at (x, y) is surrounded by something, as ascertained by isType(x, y)
const surrounded = (x, y, isType) => {
    for (const key in directions) {
        const {dx, dy} = directions[key];
        if (!isType(x + dx, y + dy)) {
            return false;
        }
    }
    return true;
};

// count the number of contiguous groups of a tile type around a tile
const countGroups = (x, y, isType) => {
    let groups = 0;
    let prevx = x + DIR11.dx;
    let prevy = y + DIR11.dy;
    for (let i = 0, dir = DIR1; i < 6; i++, dir = dir.clockwise) {
        const currx = x + dir.dx;
        const curry = y + dir.dy;
        // count the number of transitions between types
        if (!isType(prevx, prevy) && isType(currx, curry)) {
            groups++;
        }
        prevx = currx;
        prevy = curry;
    }
    // if there are no transitions, check if all neighbors are the correct type
    if (!groups && isType(prevx, prevy)) {
        return 1;
    } else {
        return groups;
    }
};

// floodfill tiles, starting from (x, y), including those that are passable(x, y), and calling callback(x, y) for each flooded tile
const floodFill = (x, y, passable, callback) => {
    if (passable(x, y)) {
        callback(x, y);
        for (const key in directions) {
            const {dx, dy} = directions[key];
            floodFill(x + dx, y + dy, passable, callback);
        }
    }
};

//========================================
//                               SCHEDULER

// create a schedule
const createSchedule = () => ({
    // add an event to the schedule delta ticks from the schedule object prev
    add(event, delta = 0, prev = this) {
        let next = prev.next;
        while (next && next.delta <= delta) {
            delta -= next.delta;
            prev = next;
            next = next.next;
        }
        prev.next = {event, delta, next};
        if (next) {
            next.delta -= delta;
        } else {
            this.last = prev.next;
        }
        return prev.next;
    },
    // add an event to the schedule delta ticks after the last event
    append(event, delta = 0) {
        this.last.next = {event, delta};
        this.last = this.last.next;
        return this.last;
    },
    // pop the next next event and return its schedule object
    // {event, delta} = next
    advance() {
        if (!this.next) {
            return undefined;
        }
        const next = this.next;
        this.next = this.next.next;
        if (next === this.last) {
            this.last === undefined;
        }
        return next;
    },
});