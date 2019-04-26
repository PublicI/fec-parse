/*
based on https://github.com/NYTimes/Fech/blob/master/lib/fech/mappings.rb
copyright (c) 2011 The New York Times Company
licensed Apache */

const renderedMaps = require('./mappings.json');

class Mappings {
    keyByRegex(maps, label) {
        if (!maps) {
            return null;
        }

        let key = Object.keys(maps)
            .sort((a, b) => a.length - b.length)
            .find(key => new RegExp(key, 'i').test(label));

        let result = key ? maps[key] : null;

        // for compatibility
        if (
            Array.isArray(result) &&
            result.includes('beginning_image_number')
        ) {
            result = result.map(value =>
                value.replace('beginning_image_number', 'begin_image_number')
            );
        }

        return result;
    }

    lookup(type, version) {
        return this.keyByRegex(this.keyByRegex(renderedMaps, type), version);
    }
}

module.exports = new Mappings();
