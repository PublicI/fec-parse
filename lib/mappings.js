/*
based from https://github.com/NYTimes/Fech/blob/master/lib/fech/mappings.rb
copyright (c) 2011 The New York Times Company
licensed Apache */

var renderedMaps = require('./mappings.json'),
    _ = require('lodash');

var Mappings = function() {
    var self = this;

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
        return self.keyByRegex(self.keyByRegex(self.maps, type),version);
    };
};

module.exports = new Mappings();
