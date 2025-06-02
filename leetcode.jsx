// LeetCode Widget for Übersicht
// Displays LeetCode submission streak and calendar for a given user.
// Set your LeetCode username below before use.

// Widget dimensions
const widgetWidth = 317;
const widgetHeight = 125;
const widgetLeft = 15;
const widgetTop = 335; // Position below GitHub widget

// Refresh every 1 hours to avoid rate limits
export const refreshFrequency = 3600000;

// --- API Configuration ---
const leetcodeUsername = "username"; // <-- Set your LeetCode username here before use
const API_BASE = 'https://leetcode-stats-api.herokuapp.com';

// --- Transform LeetCode calendar data to match our format ---
const transformCalendarData = (submissionCalendar) => {
  const weeks = [];
  const now = new Date();
  
  // Calculate the start date (52 weeks ago from current week's Sunday)
  const currentSunday = new Date(now);
  currentSunday.setDate(now.getDate() - now.getDay()); // Go to this week's Sunday
  
  const startSunday = new Date(currentSunday);
  startSunday.setDate(currentSunday.getDate() - (51 * 7)); // Go back 51 weeks (52 weeks total including current)
  
  for (let weekIndex = 0; weekIndex < 52; weekIndex++) {
    const week = { contributionDays: [] };
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDate = new Date(startSunday);
      currentDate.setDate(startSunday.getDate() + (weekIndex * 7) + dayIndex);
      
      // Only add days up to today (no future dates)
      if (currentDate <= now) {
        // Create date at start of day (midnight UTC)
        const dateAtMidnight = new Date(currentDate);
        dateAtMidnight.setUTCHours(0, 0, 0, 0);
        const timestamp = Math.floor(dateAtMidnight.getTime() / 1000).toString();
        const submissionCount = submissionCalendar[timestamp] || 0;
        
        week.contributionDays.push({
          date: currentDate.toISOString().split('T')[0],
          count: submissionCount,
          timestamp: timestamp
        });
      }
      // Don't add anything for future dates - they simply won't exist
    }
    weeks.push(week);
  }
  
  return weeks;
};

// --- Utility: Map submission count to colors ---
const getColor = (count) => {
  if (count === 0) return "#1a1a1a";
  else if (count === 1) return "#0e4429";
  else if (count === 2) return "#006d32";
  else if (count >= 3) return "#26a641";
  return "#39d353";
};

// --- Generate submission calendar SVG ---
const generateCalendarSVG = (submissions) => {
  const cellSize = 8;
  const cellMargin = 1.5;
  const cornerRadius = 1.5;
  const availableGridWidth = widgetWidth - 16;
  const weekWidth = cellSize + cellMargin;
  const weeksToShow = Math.floor(availableGridWidth / weekWidth);
  const displayWeeks = submissions.slice(-weeksToShow);
  const xOffset = 1;
  const yOffset = 5;

  const gridWidth = weeksToShow * weekWidth - cellMargin + Math.abs(xOffset);
  const gridHeight = 7 * (cellSize + cellMargin) - cellMargin + Math.abs(yOffset);

  let svgCells = "";

  displayWeeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day, dayIndex) => {
      const x = weekIndex * weekWidth + xOffset;
      const y = dayIndex * (cellSize + cellMargin) + yOffset;
      const fill = getColor(day.count);
      svgCells += `
        <rect 
          x="${x}" 
          y="${y}" 
          width="${cellSize}" 
          height="${cellSize}" 
          fill="${fill}" 
          rx="${cornerRadius}" 
          ry="${cornerRadius}"
        />`;
    });
  });

  return `
    <svg width="${gridWidth}" height="${gridHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgCells}
    </svg>`;
};

// --- Calculate statistics ---
const calculateStats = (weeks, originalSubmissionCalendar) => {
  let maxStreak = 0;
  let currentStreak = 0;

  // Flatten all days from weeks and sort by date
  const allDays = weeks.flatMap(week => week.contributionDays)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate max streak
  let tempStreak = 0;
  for (const day of allDays) {
    if (day.count > 0) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  // For current streak, use the original timestamp data for more accuracy
  // Convert timestamps to dates and sort them
  const submissionDates = Object.keys(originalSubmissionCalendar)
    .map(timestamp => {
      const date = new Date(parseInt(timestamp) * 1000);
      return {
        date: date,
        dateStr: date.toISOString().split('T')[0],
        count: originalSubmissionCalendar[timestamp]
      };
    })
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.date - a.date); // Sort by date descending (newest first)

  // Calculate current streak from the most recent submission date
  if (submissionDates.length === 0) {
    currentStreak = 0;
  } else {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    currentStreak = 0;
    let checkDate = new Date(submissionDates[0].date);
    
    // Start from the most recent submission date and count backwards
    for (let i = 0; i < submissionDates.length; i++) {
      const currentSubmissionDate = submissionDates[i].date;
      
      // Check if this date is consecutive with the previous date (or is today for first iteration)
      if (i === 0) {
        // First date - check if it's today or yesterday (allowing for some flexibility)
        const daysDiff = Math.floor((today - currentSubmissionDate) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) { // Today or yesterday
          currentStreak = 1;
          checkDate = new Date(currentSubmissionDate);
        } else {
          break;
        }
      } else {
        // Check if this date is consecutive with the previous date
        const prevDate = submissionDates[i - 1].date;
        const daysDiff = Math.floor((prevDate - currentSubmissionDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) { // Consecutive day
          currentStreak++;
          checkDate = new Date(currentSubmissionDate);
        } else {
          break; // Break the streak
        }
      }
    }
  }
  
  return { maxStreak, currentStreak };
};

// --- Fetch real LeetCode data ---
export const command = async (dispatch) => {
  try {
    // Fetch user data from herokuapp API
    const userResponse = await fetch(`${API_BASE}/${leetcodeUsername}`);

    if (!userResponse.ok) {
      if (userResponse.status === 429) {
        throw new Error('Rate limit exceeded. Data will refresh in a few hours.');
      }
      throw new Error(`API failed: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();

    // The herokuapp API structure is different - it has submissionCalendar directly
    let submissionCalendar = {};
    if (userData.submissionCalendar) {
      if (typeof userData.submissionCalendar === 'string') {
        submissionCalendar = JSON.parse(userData.submissionCalendar);
      } else {
        submissionCalendar = userData.submissionCalendar;
      }
    }

    // Transform calendar data to match our format
    const recentSubmissions = transformCalendarData(submissionCalendar);
    
    const calendarSVG = generateCalendarSVG(recentSubmissions);
    const stats = calculateStats(recentSubmissions, submissionCalendar);
    
    dispatch({ 
      type: "SET_DATA", 
      data: {
        recentSubmissions,
        calendarSVG,
        stats,
        error: null
      }
    });
    
  } catch (error) {
    dispatch({
      type: "SET_ERROR",
      error: error.message
    });
  }
};

export const initialState = { 
  data: {
    calendarSVG: "",
    stats: { maxStreak: 0, currentStreak: 0 },
    error: null
  }
};

export const updateState = (event, previousState) => {
  switch (event.type) {
    case "SET_DATA":
      return { 
        ...previousState, 
        data: event.data
      };
    case "SET_ERROR":
      return {
        ...previousState,
        data: {
          ...previousState.data,
          error: event.error
        }
      };
    default:
      return previousState;
  }
};

// --- Styling ---
import { css } from "uebersicht";

const container = css`
  position: absolute;
  left: ${widgetLeft}px;
  top: ${widgetTop}px;
  width: ${widgetWidth}px;
  height: ${widgetHeight}px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 12px;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
`;

const header = css`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  margin-left: 5px;
`;

const title = css`
  font-size: 14px;
  margin-top: 7px;
  color: #fff;
`;

const topSection = css`
  position: absolute;
  top: 15px;
  right: 12px;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

const streakCount = css`
  text-align: right;
`;

const streakNumber = css`
  font-size: 10px;
  font-weight: bold;
  color: #39d353;
  line-height: 1;
`;

const streakLabel = css`
  font-size: 10px;
  color: #666;
  margin-top: 0;
`;

const submissionSection = css`
  margin-top: 8px;
`;

const calendarContainer = css`
  background: #262626;
  border-radius: 8px;
  padding: 10px;
  overflow-x: auto;
  margin-top: -3px;
`;

const errorContainer = css`
  background: #332222;
  border: 1px solid #664444;
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
  color: #ff6666;
  font-size: 12px;
  text-align: center;
`;

// --- Render Widget ---
export const render = ({ data }) => {
  const { calendarSVG, stats, error } = data;

  return (
    <div className={container}>
      <div className={header}>
        <div className={title}>LeetCode</div>
      </div>
      <div className={topSection}>
        <div className={streakCount}>
          <div className={streakNumber}>{stats.currentStreak}</div>
          <div className={streakLabel}>streak</div>
        </div>
      </div>
      <div className={submissionSection}>
        {error ? (
          <div className={errorContainer}>
            Failed to load data: {error}
          </div>
        ) : (
          <div className={calendarContainer}>
            <div dangerouslySetInnerHTML={{ __html: calendarSVG }} />
          </div>
        )}
      </div>
    </div>
  );
};