/**
 * MongoDB aggregation: labours within great-circle distance (km) of a job,
 * matching getLabourCoords pair priority (same source for lat+lng).
 */

const EARTH_RADIUS_KM = 6371;

function buildHaversineDistanceField(jobLat, jobLng) {
  return {
    $let: {
      vars: {
        lat1r: { $degreesToRadians: { $literal: jobLat } },
        lng1r: { $degreesToRadians: { $literal: jobLng } },
        lat2r: { $degreesToRadians: "$latWork" },
        lng2r: { $degreesToRadians: "$lngWork" },
      },
      in: {
        $let: {
          vars: {
            dlat: { $subtract: ["$$lat2r", "$$lat1r"] },
            dlng: { $subtract: ["$$lng2r", "$$lng1r"] },
          },
          in: {
            $let: {
              vars: {
                a: {
                  $min: [
                    1,
                    {
                      $max: [
                        0,
                        {
                          $add: [
                            {
                              $multiply: [
                                { $sin: { $divide: ["$$dlat", 2] } },
                                { $sin: { $divide: ["$$dlat", 2] } },
                              ],
                            },
                            {
                              $multiply: [
                                { $multiply: [{ $cos: "$$lat1r" }, { $cos: "$$lat2r" }] },
                                {
                                  $multiply: [
                                    { $sin: { $divide: ["$$dlng", 2] } },
                                    { $sin: { $divide: ["$$dlng", 2] } },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
              in: {
                $multiply: [
                  EARTH_RADIUS_KM,
                  {
                    $multiply: [
                      2,
                      {
                        $atan2: [
                          { $sqrt: "$$a" },
                          { $sqrt: { $max: [0, { $subtract: [1, "$$a"] }] } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
  };
}

/** [lng, lat] in each branch — same priority as getLabourCoords. */
function buildCoordPairField() {
  return {
    coordPair: {
      $switch: {
        branches: [
          {
            case: {
              $and: [
                { $isArray: "$last_known_location" },
                { $gte: [{ $size: { $ifNull: ["$last_known_location", []] } }, 2] },
              ],
            },
            then: "$last_known_location",
          },
          {
            case: {
              $and: [
                { $ne: ["$location.latitude", null] },
                { $ne: ["$location.longitude", null] },
              ],
            },
            then: ["$location.longitude", "$location.latitude"],
          },
          {
            case: {
              $and: [
                { $isArray: "$labor_chowk_coords" },
                { $gte: [{ $size: { $ifNull: ["$labor_chowk_coords", []] } }, 2] },
              ],
            },
            then: "$labor_chowk_coords",
          },
          {
            case: {
              $and: [
                { $isArray: "$address.locationCoords" },
                { $gte: [{ $size: { $ifNull: ["$address.locationCoords", []] } }, 2] },
              ],
            },
            then: "$address.locationCoords",
          },
        ],
        default: null,
      },
    },
  };
}

const LABOUR_NOTIFY_SELECT =
  "_id pushToken pushTokens designation skillSet last_known_location location labor_chowk_coords address";

/**
 * @param {import("mongoose").Model} LaborModel
 * @param {object} labourQuery — passed to $match
 * @param {number} jobLat
 * @param {number} jobLng
 * @param {number} radiusKm — same as LABOUR_WORK_RADIUS_KM (default 15)
 */
export async function aggregateLaboursWithinRadiusKm(
  LaborModel,
  labourQuery,
  jobLat,
  jobLng,
  radiusKm
) {
  const proj = { _id: 1 };
  for (const f of LABOUR_NOTIFY_SELECT.split(/\s+/)) {
    if (f) proj[f] = 1;
  }

  const pipeline = [
    { $match: labourQuery },
    { $addFields: buildCoordPairField() },
    {
      $addFields: {
        lngWork: {
          $cond: [
            { $ne: ["$coordPair", null] },
            { $toDouble: { $arrayElemAt: ["$coordPair", 0] } },
            null,
          ],
        },
        latWork: {
          $cond: [
            { $ne: ["$coordPair", null] },
            { $toDouble: { $arrayElemAt: ["$coordPair", 1] } },
            null,
          ],
        },
      },
    },
    {
      $match: {
        latWork: {
          $gt: -90,
          $lt: 90,
        },
        lngWork: {
          $gt: -180,
          $lt: 180,
        },
      },
    },
    { $addFields: { distanceKm: buildHaversineDistanceField(jobLat, jobLng) } },
    { $match: { distanceKm: { $lte: radiusKm } } },
    { $project: proj },
  ];

  return LaborModel.aggregate(pipeline).allowDiskUse(true);
}

export { LABOUR_NOTIFY_SELECT };
