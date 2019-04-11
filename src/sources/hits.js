'use strict';

var _ = require('../common/utils.js');
var version = require('../../version.js');
var parseAlgoliaClientVersion = require('../common/parseAlgoliaClientVersion.js');
var RecentSearches = require('recent-searches');

function filterHits(hits, lastSearches, recentSearches) {
  const suggestedQueries = new Set(lastSearches.map(s => s.meta.objectID));
  const filteredHits = hits.filter(hit => !suggestedQueries.has(hit.objectID));

  if (recentSearches) {
    const enrichedHits = filteredHits.map(hit => {
      hit.__proto__._saveAsRecent = function(search, hitToSave) {
        recentSearches.setRecentSearch(search, hitToSave);
      };
      return hit;
    });

    return lastSearches.map(search => {
      search.meta.__recentSearch = true;
      return search.meta;
    }).concat(enrichedHits);
  }

  return hits;
}

module.exports = function search(index, params, withRecentSearches) {
  var algoliaVersion = parseAlgoliaClientVersion(index.as._ua);
  var recentSearches = withRecentSearches ? new RecentSearches.default({namespace: '__' + index.indexName + '_RECENT_SEARCHES__'}) : null;

  if (algoliaVersion && algoliaVersion[0] >= 3 && algoliaVersion[1] > 20) {
    params = params || {};
    params.additionalUA = 'autocomplete.js ' + version;
  }

  return sourceFn;

  function sourceFn(query, cb) {
    index.search(query, params, function(error, content) {
      if (error) {
        _.error(error.message);
        return;
      }
      var lastSearchesForQuery = recentSearches && recentSearches.getRecentSearches(query);
      var hits = withRecentSearches && lastSearchesForQuery ? filterHits(content.hits, lastSearchesForQuery, recentSearches) : content.hits;

      cb(hits, content);
    });
  }
};
