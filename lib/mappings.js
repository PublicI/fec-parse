var renderedMaps = require('./renderedmaps'),
    _ = require('lodash'),
    LRU = require('lru-cache');

var Mappings = function() {
    var self = this;

    self.cache = LRU({
        max: 200
    });

    self.maps = renderedMaps;

    self.keyByRegex = function (maps,label) {
        var map = null;

        _(maps).keys().sortBy('length').reverse().some(function (key) {
            if ((new RegExp(key, 'i')).test(label)) {
                map = maps[key];
                return true;
            }
            return false;
        });

        return map;
    };

    self.lookup = function (type,version) {
        var map = self.cache.get((type + '|' + version).trim().toLowerCase());

        if (map) {
            return map;
        }

        map = self.keyByRegex(self.keyByRegex(self.maps, type),version);
        self.cache.set((type + '|' + version).trim().toLowerCase(),map);

        return map;
    };
};

module.exports = new Mappings();
