var fs = require('fs');
var path = require('path');

(function init() {

  loadFile(function (data) {

    data = transform(data);
    data = aggregate(data);
    data = analyse(data);

    saveFile('./output/weightedPolicy.json', JSON.stringify(data, null, 2));
  });
})();

function loadFile(callback) {

  fs.readFile('./input/documents-fipi.json', 'utf8', function (error, result) {

    if (!error) {

      callback(JSON.parse(result));
    } else {

      console.log(error);
    }
  });
}

function transform(data) {

  var result = {};
  var parties = Object.keys(data);

  parties.forEach(function (party) {

    result[party] = {};

    var paragraphs = data[party];

    paragraphs.forEach(function (paragraph) {

      paragraph.fipi.domain.forEach(function (policy) {

        var left = paragraph.fipi.leftright[1].prediction;
        var right = paragraph.fipi.leftright[0].prediction;
        var weight = policy.prediction;

        // @TODO Refactor
        if (result[party][policy.label]) {

          result[party][policy.label].left.push(left);
          result[party][policy.label].right.push(right);
          result[party][policy.label].weight.push(weight);
        } else {

          result[party][policy.label] = {

            left: [left],
            right: [right],
            weight: [weight]
          };
        }
      });
    });
  });

  return result;
}

function aggregate(data) {

  var parties = Object.keys(data);

  parties.forEach(function (party) {

    data[party]['Total'] = {

      left: mergeArrays(data[party], 'left'),
      right: mergeArrays(data[party], 'right'),
      weight: mergeArrays(data[party], 'weight')
    };

    data[party].count = objectSum(data[party], 'weight');
  });

  return data;
}

function analyse(data) {

  var result = {};
  var parties = Object.keys(data);

  parties.forEach(function (party) {

    var policies = Object.keys(data[party]);

    policies.forEach(function (policy) {

      if (data[party][policy].hasOwnProperty('weight')) {

        var left = data[party][policy].left;
        var right = data[party][policy].right;
        var weight = data[party][policy].weight;

        var values = arrayDifference(left, right);
        var percent = arraySum(weight) / data[party].count * 100;

        if (!result[policy]) result[policy] = [];

        result[policy].push({

          party: party,
          percent: Math.round(percent * 100) / 100,
          min: Math.round(Math.min.apply(null, values) * 100) / 100,
          max: Math.round(Math.max.apply(null, values) * 100) / 100,
          mean: Math.round(weightedMean(values, weight) * 100) / 100,
          median: Math.round(weightedMedian(values, weight) * 100) / 100,
          stdDev: Math.round(weightedStdDev(values, weight) * 100) / 100
        });
      }
    });
  });

  //console.log(result);
  return result;
}

function arrayDifference(a, b) {

  return a.map(function (value, i) {

    return b[i] - value;
  });
}

function arraySum(arr) {

  return arr.reduce(function (previous, current) {

    return previous + current;
  });
}

function objectSum(obj, key) {

  return Object.keys(obj).reduce(function (previous, current) {

    return previous + arraySum(obj[current][key]);
  }, 0);
}

function weightedMean(values, weights) {

  var result = values.map(function (value, i) {

    var weight = weights[i];
    var sum = value * weight;

    return [sum, weight];
  }).reduce(function (previous, current) {

    return [previous[0] + current[0], previous[1] + current[1]];
  }, [0, 0]);

  return result[0] / result[1];
}

function weightedMedian(values, weights) {

  var midpoint = 0.5 * arraySum(weights);

  var cumulativeWeight = 0;
  var belowMidpointIndex = 0;

  var sortedValues = [];
  var sortedWeights = [];

  values.map(function (value, i) {

    return [value, weights[i]];
  }).sort(function (a, b) {

    return a[0] - b[0];
  }).map(function (pair) {

    sortedValues.push(pair[0]);
    sortedWeights.push(pair[1]);
  });

  if (sortedWeights.some(function (value) { return value > midpoint; })) {

    return sortedValues[sortedWeights.indexOf(Math.max.apply(null, sortedWeights))];
  }

  while (cumulativeWeight <= midpoint) {

    belowMidpointIndex++;
    cumulativeWeight += sortedWeights[belowMidpointIndex - 1];
  }

  cumulativeWeight -= sortedWeights[belowMidpointIndex - 1];

  if (cumulativeWeight - midpoint < Number.EPSILON) {

    var bounds = sortedValues.slice(belowMidpointIndex - 2, belowMidpointIndex);
    return arraySum(bounds) / bounds.length;
  }

  return sortedValues[belowMidpointIndex - 1];
}

function weightedStdDev(values, weights) {

  var avg = weightedMean(values, weights);

  var result = values.map(function (value, i) {

    var weight = weights[i];
    var diff = value - avg;
    var sqrDiff = weight * Math.pow(diff, 2);

    return [sqrDiff, weight];
  }).reduce(function (previous, current) {

    return [previous[0] + current[0], previous[1] + current[1]];
  }, [0, 0]);

  return Math.sqrt(result[0] / result[1]);
}


function mergeArrays(obj, key) {

  return Object.keys(obj).reduce(function (previous, current) {

    return previous.concat(obj[current][key]);
  }, []);
}

function saveFile(relativePath, string) {

  relativePath = path.normalize(relativePath);

  console.log('Saved file', relativePath);

  try {

    return fs.writeFileSync(relativePath, string, 'utf8');
  } catch (error) {

    console.log(error);
  }
}
