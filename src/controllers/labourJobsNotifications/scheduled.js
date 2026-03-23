import { LabourRequirementModel } from "../../models/labourRequirementModel.js";
import { LabourApplyModel } from "../../models/labourApplyModel.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * GET jobs that have no applications (and no selection) and either:
 * - 2+ hours have passed since the job was created (dateCreated + 2h <= now), or
 * - jobDate is within the next 2 hours (now <= jobDate <= now + 2h).
 * Useful for scheduled re-notification or cleanup.
 */
export const getJobsWithNoApplicationDueForNotify = async (req, res) => {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);
    const twoHoursFromNow = new Date(now.getTime() + TWO_HOURS_MS);

    const jobIdsWithApplications = await LabourApplyModel.distinct("labourJobId").lean();

    const jobs = await LabourRequirementModel.find({
      _id: { $nin: jobIdsWithApplications },
      isActive: true,
      $or: [
        { dateCreated: { $lte: twoHoursAgo } },
        {
          jobDate: { $gte: now, $lte: twoHoursFromNow },
        },
      ],
    })
      .sort({ jobDate: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("getJobsWithNoApplicationDueForNotify:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch jobs",
    });
  }
};
