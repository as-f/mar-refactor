'use strict';

// ===== //
// #PRNG //
// ===== //

var prng = Math.random;
Math.random = undefined;

// =========== //
// #Directions //
// =========== //

// direction names are based on clock directions
var DIR1 = {
    dx: 1,
    dy: -1,
    dz: 0
};
var DIR3 = {
    dx: 1,
    dy: 0,
    dz: -1
};
var DIR5 = {
    dx: 0,
    dy: 1,
    dz: -1
};
var DIR7 = {
    dx: -1,
    dy: 1,
    dz: 0
};
var DIR9 = {
    dx: -1,
    dy: 0,
    dz: 1
};
var DIR11 = {
    dx: 0,
    dy: -1,
    dz: 1
};

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

var directions = { DIR1: DIR1, DIR3: DIR3, DIR5: DIR5, DIR7: DIR7, DIR9: DIR9, DIR11: DIR11 };

// ====== //
// #Tiles //
// ====== //

var WALL = 0;
var FLOOR = 1;

var TILES = {
    WALL: WALL,
    FLOOR: FLOOR
};

// ========== //
// #Utilities //
// ========== //

// generate a random integer in the interval [min, max]
var randInt = function randInt(min, max, prng) {
    if (min > max) {
        console.error('randInt: min > max');
        return NaN;
    }
    return min + (max - min + 1) * prng() << 0;
};

// pick a random element of an array or object
var randElement = function randElement(array, prng) {
    var keys = Object.keys(array);
    return array[keys[randInt(0, array.length - 1, prng)]];
};

// ====== //
// #Level //
// ====== //

var forEachTileOfLevel = function forEachTileOfLevel(width, height, fun) {
    for (var y = 0; y < height; y++) {
        for (var x = Math.floor((height - y) / 2); x < width - Math.floor(y / 2); x++) {
            fun(x, y);
        }
    }
};

var forEachInnerTileOfLevel = function forEachInnerTileOfLevel(width, height, fun) {
    for (var y = 1; y < height - 1; y++) {
        for (var x = Math.floor((height - y) / 2) + 1; x < width - Math.floor(y / 2) - 1; x++) {
            fun(x, y);
        }
    }
};

var inBounds = function inBounds(width, height, x, y) {
    return y >= 0 && y < height && x >= Math.floor((height - y) / 2) && x < width - Math.floor(y / 2);
};

var inInnerBounds = function inInnerBounds(width, height, x, y) {
    return y > 0 && y < height - 1 && x > Math.floor((height - y) / 2) && x < width - Math.floor(y / 2) - 1;
};

var surrounded = function surrounded(x, y, isType) {
    for (var key in directions) {
        var _directions$key = directions[key];
        var dx = _directions$key.dx;
        var dy = _directions$key.dy;

        if (!isType(x + dx, y + dy)) {
            return false;
        }
    }
    return true;
};

// count the number of contiguous groups of a tile type around a tile
var countGroups = function countGroups(x, y, isType) {
    var groups = 0;
    var prevx = x + DIR11.dx;
    var prevy = y + DIR11.dy;
    for (var i = 0, dir = DIR1; i < 6; i++, dir = dir.clockwise) {
        var currx = x + dir.dx;
        var curry = y + dir.dy;
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

var floodFill = function floodFill(x, y, passable, callback) {
    if (passable(x, y)) {
        callback(x, y);
        for (var key in directions) {
            var _directions$key2 = directions[key];
            var dx = _directions$key2.dx;
            var dy = _directions$key2.dy;

            floodFill(x + dx, y + dy, passable, callback);
        }
    }
};

var createLevel = function createLevel(_ref) {
    var width = _ref.width;
    var height = _ref.height;
    var prng = _ref.prng;
    var _ref$startx = _ref.startx;
    var startx = _ref$startx === undefined ? 24 : _ref$startx;
    var _ref$starty = _ref.starty;
    var starty = _ref$starty === undefined ? 15 : _ref$starty;

    var level = [];

    for (var x = 0; x < width; x++) {
        level[x] = [];
        for (var y = 0; y < height; y++) {
            level[x][y] = {
                type: WALL
            };
        }
    }

    var forEachTile = forEachTileOfLevel.bind(null, width, height);
    var forEachInnerTile = forEachInnerTileOfLevel.bind(null, width, height);

    // floor at starting point
    level[startx][starty].type = FLOOR;

    // main algorithm
    var scrambledTiles = [];
    forEachInnerTile(function (x, y) {
        scrambledTiles.splice(randInt(0, scrambledTiles.length, prng), 0, { x: x, y: y });
    });

    var isWall = function isWall(x, y) {
        return level[x][y].type === WALL;
    };

    for (var i = 0; i < scrambledTiles.length; i++) {
        var _scrambledTiles$i = scrambledTiles[i];
        var _x = _scrambledTiles$i.x;
        var _y = _scrambledTiles$i.y;

        if (surrounded(_x, _y, isWall) || countGroups(_x, _y, isWall) !== 1) {
            level[_x][_y].type = FLOOR;
        }
    }

    // find size of wall groups
    forEachTile(function (x, y) {
        if (level[x][y].type === FLOOR || level[x][y].wallGroup) {
            return;
        }
        var wallGroup = { size: 0 };
        var passable = function passable(x, y) {
            return inBounds(width, height, x, y) && level[x][y].type === WALL && !level[x][y].wallGroup;
        };
        var callback = function callback(x, y) {
            level[x][y].wallGroup = wallGroup;
            wallGroup.size++;
        };
        floodFill(x, y, passable, callback);
    });

    // remove wall groups with <6 walls
    forEachTile(function (x, y) {
        if (level[x][y].type === WALL) {
            if (level[x][y].wallGroup.size < 6) {
                level[x][y] = { type: FLOOR };
            } else {
                level[x][y] = { type: WALL };
            }
        }
    });

    // find the size of the open space around the starting point
    var mainCaveSize = 0;
    var passable = function passable(x, y) {
        return level[x][y].type === FLOOR && !level[x][y].flooded;
    };
    var callback = function callback(x, y) {
        level[x][y].flooded = true;
        mainCaveSize++;
    };
    floodFill(startx, starty, passable, callback);

    // fill in other discontinuous caves
    forEachTile(function (x, y) {
        if (level[x][y].type === FLOOR && !level[x][y].flooded) {
            level[x][y] = { type: WALL };
        }
    });

    alert(mainCaveSize);

    return level;
};

// ===== //
// #Game //
// ===== //

var createGame = function createGame(_ref2) {
    var width = _ref2.width;
    var height = _ref2.height;
    var prng = _ref2.prng;
    var updateTile = _ref2.updateTile;
    var updateDraw = _ref2.updateDraw;

    var game = {};

    var forEachTile = forEachTileOfLevel.bind(null, width, height);

    var level = createLevel({
        width: width,
        height: height,
        prng: prng
    });

    forEachTile(function (x, y) {
        updateTile(x, y, {
            type: level[x][y].type
        });
    });

    updateDraw();
};

// ======== //
// #Display //
// ======== //

var WIDTH = 48;
var HEIGHT = 31;

var XU = 18;
var TILEHEIGHT = 24;
var YU = 16;

var $game = document.getElementById('game');
$game.style.width = (WIDTH - HEIGHT / 2 + 1) * XU + 'px';
$game.style.height = TILEHEIGHT + (HEIGHT - 1) * YU + 'px';

var canvases = [];
var bgcanvases = [];
var ctxs = [];
var bgctxs = [];
for (var i = 0; i < HEIGHT; i++) {
    var canvas = document.createElement('canvas');
    canvas.width = (WIDTH - HEIGHT / 2 + 1) * XU;
    canvas.height = TILEHEIGHT;
    canvas.style.top = i * YU + 'px';
    var ctx = canvas.getContext('2d');
    canvases[i] = canvas;
    ctxs[i] = ctx;

    var bgcanvas = document.createElement('canvas');
    bgcanvas.width = canvas.width;
    bgcanvas.height = canvas.height;
    bgcanvas.style.top = canvas.style.top;
    var bgctx = bgcanvas.getContext('2d');
    bgcanvases[i] = bgcanvas;
    bgctxs[i] = bgctx;

    $game.appendChild(bgcanvas);
    $game.appendChild(canvas);
}

// Visual info for tiles
var tileset = document.createElement('img');

var displayTiles = {
    WALL: {
        spritex: 0,
        spritey: 0,
        color: '#FFF'
    },
    FLOOR: {
        spritex: 1,
        spritey: 0,
        color: '#FFF'
    }
};

var cacheTiles = function cacheTiles() {
    for (var TILE in TILES) {
        var displayTile = displayTiles[TILE];
        var _canvas = document.createElement('canvas');
        _canvas.width = XU;
        _canvas.height = TILEHEIGHT;
        var _ctx = _canvas.getContext('2d');
        _ctx.drawImage(tileset, displayTile.spritex * XU, displayTile.spritey * TILEHEIGHT, XU, TILEHEIGHT, 0, 0, XU, TILEHEIGHT);
        _ctx.fillStyle = displayTile.color;
        _ctx.globalCompositeOperation = 'source-in';
        _ctx.fillRect(0, 0, XU, TILEHEIGHT);
        displayTile.canvas = _canvas;

        displayTiles[TILES[TILE]] = displayTiles[TILE];
    }
};

var level = [];
for (var x = 0; x < WIDTH; x++) {
    level[x] = [];
    for (var y = 0; y < HEIGHT; y++) {
        level[x][y] = {};
    }
}

var forEachTile = forEachTileOfLevel.bind(null, WIDTH, HEIGHT);

var draw = function draw() {
    forEachTile(function (x, y) {
        var ctx = ctxs[y];
        var displayTile = displayTiles[level[x][y].type];
        var realx = (x - (HEIGHT - y - 1) / 2) * XU;
        ctx.drawImage(displayTile.canvas, 0, 0, XU, TILEHEIGHT, realx, 0, XU, TILEHEIGHT);
    });
};

var updateTile = function updateTile(x, y, attributes) {
    for (var key in attributes) {
        level[x][y][key] = attributes[key];
    }
};

// Remove this later ;  display should decide to draw when the player actor is updated
var updateDraw = function updateDraw() {
    draw();
};

var game = void 0;
var startGame = function startGame() {
    cacheTiles();
    game = createGame({
        width: WIDTH,
        height: HEIGHT,
        prng: prng,
        updateTile: updateTile,
        updateDraw: updateDraw
    });
};

tileset.addEventListener('load', startGame);
tileset.src = 'tileset2.png';