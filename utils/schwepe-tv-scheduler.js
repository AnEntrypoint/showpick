/**
 * Schwepe TV Scheduler - GMT-based deterministic scheduling utilities
 * Shared with 420sched for consistent time management
 */

class SchwepeTVScheduler {
    constructor() {
        this.GMT_SEED = 247420;
        this.SLOT_DURATION = 30; // 30-minute slots
    }

    /**
     * Get current GMT time slot information
     */
    getCurrentTimeSlot(now = new Date()) {
        // Use GMT time for consistent scheduling worldwide
        const gmtNow = new Date(now.toUTCString());
        const dayOfWeek = gmtNow.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const hours = gmtNow.getUTCHours();
        const minutes = gmtNow.getUTCMinutes();
        const currentMinutes = hours * 60 + minutes;

        // Calculate the current time slot (30-minute slots)
        const timeSlot = Math.floor(currentMinutes / this.SLOT_DURATION);
        const slotStartMinute = timeSlot * this.SLOT_DURATION;
        const elapsedMinutesInSlot = currentMinutes - slotStartMinute;

        // Map day numbers to day names
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];

        return {
            gmtNow,
            dayOfWeek,
            dayName,
            hours,
            minutes,
            currentMinutes,
            timeSlot,
            slotStartMinute,
            elapsedMinutesInSlot,
            slotKey: `${dayName}-${timeSlot}`
        };
    }

    /**
     * Create deterministic selection based on time slot
     */
    getDeterministicSelection(slotKey, options, seed = this.GMT_SEED) {
        // Create a deterministic hash based on the time slot key and seed
        let hash = 0;
        const combinedKey = `${seed}-${slotKey}`;

        for (let i = 0; i < combinedKey.length; i++) {
            const char = combinedKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        const index = Math.abs(hash) % options.length;
        return {
            index,
            selected: options[index],
            hash: Math.abs(hash)
        };
    }

    /**
     * Calculate seek position for video synchronization
     */
    calculateSeekPosition(content, currentTimeSlot) {
        const elapsedMinutes = currentTimeSlot.elapsedMinutesInSlot;
        const seekPosition = Math.max(0, elapsedMinutes * 60);

        // Don't seek past the video duration if known
        const maxSeek = (content.duration_minutes * 60) - 5; // 5 seconds before end
        return Math.min(seekPosition, maxSeek);
    }

    /**
     * Calculate current video in montage and seek position
     */
    calculateMontagePosition(montageVideos, currentTimeSlot) {
        const elapsedSeconds = currentTimeSlot.elapsedMinutesInSlot * 60;
        let accumulatedTime = 0;
        let currentVideoIndex = 0;
        let seekPosition = 0;

        for (let i = 0; i < montageVideos.length; i++) {
            const videoDuration = montageVideos[i].duration_seconds || 1800; // Default 30 minutes
            const videoEndTime = accumulatedTime + videoDuration;

            if (elapsedSeconds < videoEndTime) {
                currentVideoIndex = i;
                seekPosition = elapsedSeconds - accumulatedTime;
                break;
            }

            accumulatedTime = videoEndTime;
        }

        return {
            videoIndex: currentVideoIndex,
            seekPosition: Math.max(0, seekPosition),
            accumulatedTime,
            totalElapsed: elapsedSeconds
        };
    }

    /**
     * Get videos for current time slot with montage support
     */
    getVideosForTimeSlot(scheduleData, currentTimeSlot, seed = this.GMT_SEED) {
        if (!scheduleData || !scheduleData.v || !scheduleData.s) {
            return { videos: [], isMontage: false };
        }

        // Convert slot number to time string (e.g., 22 → "11:00 AM")
        const slotHour = Math.floor(currentTimeSlot.timeSlot / 2);
        const slotMinute = (currentTimeSlot.timeSlot % 2) * 30;
        const isPM = slotHour >= 12;
        const displayHour = slotHour === 0 ? 12 : slotHour > 12 ? slotHour - 12 : slotHour;
        const timeString = `${displayHour}:${slotMinute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

        // Find all schedule entries for current day and time
        const matchingEntries = scheduleData.s.filter(entry =>
            entry.d === currentTimeSlot.dayName && entry.t === timeString
        );

        if (matchingEntries.length === 0) {
            console.warn(`⚠️ No schedule entry for ${currentTimeSlot.dayName} ${timeString}`);
            return { videos: [], isMontage: false };
        }

        // If multiple entries at same time, use deterministic selection
        const selectedEntry = matchingEntries.length > 1
            ? matchingEntries[Math.abs(this.getDeterministicSelection(currentTimeSlot.slotKey, matchingEntries, seed).index)]
            : matchingEntries[0];

        // Get video data from video database
        const videoKey = selectedEntry.v;
        const videoData = scheduleData.v[videoKey];

        if (!videoData) {
            console.error(`❌ Video not found in database: ${videoKey}`);
            return { videos: [], isMontage: false };
        }

        // Add duration from schedule entry
        const enrichedVideoData = {
            ...videoData,
            duration_seconds: selectedEntry.du,
            scheduleKey: videoKey
        };

        // Check if this entry has multiple videos (montage)
        if (videoData.montage && Array.isArray(videoData.montage)) {
            return {
                videos: videoData.montage,
                isMontage: true,
                entryId: videoKey,
                entryData: enrichedVideoData,
                scheduleEntry: selectedEntry
            };
        } else {
            // Single video entry
            return {
                videos: [enrichedVideoData],
                isMontage: false,
                entryId: videoKey,
                entryData: enrichedVideoData,
                scheduleEntry: selectedEntry
            };
        }
    }

    /**
     * Calculate time remaining in current slot
     */
    getTimeRemainingInSlot(currentTimeSlot) {
        const slotDurationSeconds = this.SLOT_DURATION * 60;
        const elapsedSeconds = currentTimeSlot.elapsedMinutesInSlot * 60;
        return Math.max(0, slotDurationSeconds - elapsedSeconds);
    }

    /**
     * Determine if we should transition to next time slot
     */
    shouldTransitionToNextSlot(content, currentTimeSlot) {
        const slotProgress = currentTimeSlot.elapsedMinutesInSlot / this.SLOT_DURATION;
        return slotProgress >= 0.95; // Transition at 95% through slot
    }

    /**
     * Get next time slot information
     */
    getNextTimeSlot(currentTimeSlot) {
        const nextMinutes = currentTimeSlot.slotStartMinute + this.SLOT_DURATION;
        const nextHours = Math.floor(nextMinutes / 60);
        const nextMinutesInHour = nextMinutes % 60;

        // Handle day rollover
        const nextDayOfWeek = (currentTimeSlot.dayOfWeek + Math.floor(nextHours / 24)) % 7;
        const nextHourInDay = nextHours % 24;

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        return {
            dayOfWeek: nextDayOfWeek,
            dayName: dayNames[nextDayOfWeek],
            hours: nextHourInDay,
            minutes: nextMinutesInHour,
            timeSlot: currentTimeSlot.timeSlot + 1,
            slotKey: `${dayNames[nextDayOfWeek]}-${currentTimeSlot.timeSlot + 1}`
        };
    }

    /**
     * Format time for display
     */
    formatTimeSlot(timeSlot) {
        const hour = Math.floor(timeSlot / 2);
        const minute = (timeSlot % 2) * 30;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} GMT`;
    }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchwepeTVScheduler;
} else if (typeof window !== 'undefined') {
    window.SchwepeTVScheduler = SchwepeTVScheduler;
}

export default SchwepeTVScheduler;