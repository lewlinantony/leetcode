// LeetCode Widget for Übersicht
// Displays LeetCode submission streak and calendar for a given user
// 
// SETUP INSTRUCTIONS:
// 1. Set your LeetCode username in the configuration section below
// 2. Optionally adjust widget position and timezone settings
// 3. Save this file as 'leetcode.jsx' in your Übersicht widgets folder

// =============================================================================
// CONFIGURATION - EDIT THESE VALUES
// =============================================================================

// Your LeetCode username (REQUIRED - replace with your actual username)
const LEETCODE_USERNAME = "your_username_here"; // <-- CHANGE THIS

// Widget position on screen
const WIDGET_POSITION = {
  left: 15,    // Distance from left edge of screen
  top: 335,    // Distance from top of screen
  width: 317,  // Widget width
  height: 125  // Widget height
};

// Timezone settings (IST = Indian Standard Time, UTC+5:30)
// Change this if you want to use a different timezone for midnight reset
const TIMEZONE_OFFSET_HOURS = 5.5; // IST offset from UTC

// Refresh interval (in milliseconds)
// 3600000 = 1 hour (recommended to avoid rate limits)
const REFRESH_INTERVAL = 3600000;

// =============================================================================
// WIDGET CODE - NO NEED TO EDIT BELOW THIS LINE
// =============================================================================

export const refreshFrequency = REFRESH_INTERVAL;

// API Configuration
const API_BASE = 'https://leetcode-stats-api.herokuapp.com';

// Validate username
if (LEETCODE_USERNAME === "your_username_here" || !LEETCODE_USERNAME) {
  console.error("❌ LeetCode Widget: Please set your username in LEETCODE_USERNAME");
}

// --- Timezone Functions ---
const getCurrentDateInTimezone = () => {
  const now = new Date();
  const offsetMs = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  const timezoneTime = new Date(now.getTime() + offsetMs);
  console.log(`📅 Current time (UTC+${TIMEZONE_OFFSET_HOURS}):`, timezoneTime.toISOString());
  return timezoneTime;
};

const getStartOfDay = (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

// --- Transform LeetCode calendar data ---
const transformCalendarData = (submissionCalendar) => {
  const weeks = [];
  const now = getCurrentDateInTimezone();
  
  // Calculate 52 weeks of data ending with current week
  const currentSunday = new Date(now);
  currentSunday.setDate(now.getDate() - now.getDay());
  
  const startSunday = new Date(currentSunday);
  startSunday.setDate(currentSunday.getDate() - (51 * 7));
  
  // Get today's date string
  const today = getStartOfDay(now);
  const todayDateStr = today.toISOString().split('T')[0];
  
  for (let weekIndex = 0; weekIndex < 52; weekIndex++) {
    const week = { contributionDays: [] };
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDate = new Date(startSunday);
      currentDate.setDate(startSunday.getDate() + (weekIndex * 7) + dayIndex);
      
      // Only include dates up to today
      if (currentDate <= now) {
        const dateAtMidnight = new Date(currentDate);
        dateAtMidnight.setUTCHours(0, 0, 0, 0);
        const timestamp = Math.floor(dateAtMidnight.getTime() / 1000).toString();
        
        const currentDateStr = currentDate.toISOString().split('T')[0];
        const isToday = currentDateStr === todayDateStr;
        const submissionCount = submissionCalendar[timestamp] || 0;
        
        week.contributionDays.push({
          date: currentDateStr,
          count: submissionCount,
          timestamp: timestamp,
          isToday: isToday
        });
      }
    }
    weeks.push(week);
  }
  
  return weeks;
};

// --- Color mapping for submission counts ---
const getSubmissionColor = (count, isToday = false) => {
  if (count === 0) return isToday ? "#2a2a2a" : "#1a1a1a";
  if (count === 1) return "#0e4429";
  if (count === 2) return "#006d32";
  if (count >= 3) return "#26a641";
  return "#39d353";
};

// --- Generate calendar SVG ---
const generateCalendarSVG = (submissions) => {
  const cellSize = 8;
  const cellMargin = 1.5;
  const cornerRadius = 1.5;
  const availableWidth = WIDGET_POSITION.width - 16;
  const weekWidth = cellSize + cellMargin;
  const weeksToShow = Math.floor(availableWidth / weekWidth);
  const displayWeeks = submissions.slice(-weeksToShow);
  
  const gridWidth = weeksToShow * weekWidth - cellMargin + 1;
  const gridHeight = 7 * (cellSize + cellMargin) - cellMargin + 5;

  let svgCells = "";

  displayWeeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day, dayIndex) => {
      const x = weekIndex * weekWidth + 1;
      const y = dayIndex * (cellSize + cellMargin) + 5;
      const fill = getSubmissionColor(day.count, day.isToday);
      const stroke = day.isToday ? "#555" : "none";
      const strokeWidth = day.isToday ? "0.5" : "0";
      
      svgCells += `
        <rect 
          x="${x}" y="${y}" 
          width="${cellSize}" height="${cellSize}" 
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
          rx="${cornerRadius}" ry="${cornerRadius}"
        />`;
    });
  });

  return `<svg width="${gridWidth}" height="${gridHeight}" xmlns="http://www.w3.org/2000/svg">${svgCells}</svg>`;
};

// --- Calculate streak statistics ---
const calculateStreaks = (weeks, originalSubmissionCalendar) => {
  // Calculate max streak
  const allDays = weeks.flatMap(week => week.contributionDays)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let maxStreak = 0;
  let tempStreak = 0;
  
  for (const day of allDays) {
    if (day.count > 0) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  // Calculate current streak
  const submissionDates = Object.keys(originalSubmissionCalendar)
    .map(timestamp => ({
      date: new Date(parseInt(timestamp) * 1000),
      count: originalSubmissionCalendar[timestamp]
    }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.date - a.date);

  let currentStreak = 0;
  if (submissionDates.length > 0) {
    const today = getCurrentDateInTimezone();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 0; i < submissionDates.length; i++) {
      const currentDate = submissionDates[i].date;
      
      if (i === 0) {
        const daysDiff = Math.floor((today - currentDate) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) {
          currentStreak = 1;
        } else {
          break;
        }
      } else {
        const prevDate = submissionDates[i - 1].date;
        const daysDiff = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }
  
  return { maxStreak, currentStreak };
};

// --- API Data Fetching ---
export const command = async (dispatch) => {
  // Check if username is configured
  if (LEETCODE_USERNAME === "your_username_here" || !LEETCODE_USERNAME) {
    dispatch({
      type: "SET_ERROR",
      error: "Please set your LeetCode username in the widget configuration"
    });
    return;
  }

  try {
    console.log(`🚀 Fetching LeetCode data for: ${LEETCODE_USERNAME}`);
    
    const response = await fetch(`${API_BASE}/${LEETCODE_USERNAME}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User '${LEETCODE_USERNAME}' not found. Please check your username.`);
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Will retry in next refresh cycle.');
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const userData = await response.json();
    
    // Parse submission calendar
    let submissionCalendar = {};
    if (userData.submissionCalendar) {
      submissionCalendar = typeof userData.submissionCalendar === 'string' 
        ? JSON.parse(userData.submissionCalendar)
        : userData.submissionCalendar;
    }

    // Process data
    const recentSubmissions = transformCalendarData(submissionCalendar);
    const calendarSVG = generateCalendarSVG(recentSubmissions);
    const stats = calculateStreaks(recentSubmissions, submissionCalendar);
    
    console.log(`✅ LeetCode data loaded - Current streak: ${stats.currentStreak}, Max streak: ${stats.maxStreak}`);
    
    dispatch({ 
      type: "SET_DATA", 
      data: {
        recentSubmissions,
        calendarSVG,
        stats,
        error: null,
        loading: false,
        username: LEETCODE_USERNAME
      }
    });
    
  } catch (error) {
    console.error('❌ LeetCode API error:', error.message);
    dispatch({
      type: "SET_ERROR",
      error: error.message
    });
  }
};

// --- State Management ---
export const initialState = { 
  data: {
    calendarSVG: "",
    stats: { maxStreak: 0, currentStreak: 0 },
    error: null,
    loading: true,
    username: LEETCODE_USERNAME
  }
};

export const updateState = (event, previousState) => {
  switch (event.type) {
    case "SET_DATA":
      return { ...previousState, data: event.data };
    case "SET_ERROR":
      return {
        ...previousState,
        data: {
          ...previousState.data,
          error: event.error,
          loading: false
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
  left: ${WIDGET_POSITION.left}px;
  top: ${WIDGET_POSITION.top}px;
  width: ${WIDGET_POSITION.width}px;
  height: ${WIDGET_POSITION.height}px;
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
  justify-content: space-between;
  margin-bottom: 12px;
  margin-left: 5px;
`;

const title = css`
  font-size: 14px;
  color: #fff;
`;

const username = css`
  font-size: 10px;
  color: #666;
  margin-right: 8px;
`;

const streakSection = css`
  position: absolute;
  top: 15px;
  right: 12px;
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

const calendarSection = css`
  margin-top: 8px;
`;

const calendarContainer = css`
  background: #262626;
  border-radius: 8px;
  padding: 10px;
  overflow-x: auto;
  margin-top: -3px;
`;

const messageContainer = css`
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
`;

const errorContainer = css`
  ${messageContainer}
  background: #332222;
  border: 1px solid #664444;
  color: #ff6666;
`;

const loadingContainer = css`
  ${messageContainer}
  background: #262626;
  color: #999;
`;

// --- Render Widget ---
export const render = ({ data }) => {
  const { calendarSVG, stats, error, loading, username } = data;

  return (
    <div className={container}>
      <div className={header}>
        <div className={title}>LeetCode</div>
        {username && username !== "your_username_here" && (
          <div className={username}>@{username}</div>
        )}
      </div>
      
      <div className={streakSection}>
        <div className={streakNumber}>{stats.currentStreak}</div>
        <div className={streakLabel}>streak</div>
      </div>
      
      <div className={calendarSection}>
        {loading ? (
          <div className={loadingContainer}>Loading...</div>
        ) : error ? (
          <div className={errorContainer}>{error}</div>
        ) : (
          <div className={calendarContainer}>
            <div dangerouslySetInnerHTML={{ __html: calendarSVG }} />
          </div>
        )}
      </div>
    </div>
  );
};