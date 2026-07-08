"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWeekend = isWeekend;
exports.getWorkingDaysInMonth = getWorkingDaysInMonth;
exports.getWorkingDaysElapsed = getWorkingDaysElapsed;
exports.getPerformanceCategory = getPerformanceCategory;
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}
function getWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        if (!isWeekend(new Date(year, month - 1, day)))
            count++;
    }
    return count;
}
function getWorkingDaysElapsed(year, month, today) {
    let count = 0;
    const current = today.getDate();
    for (let day = 1; day <= current; day++) {
        if (!isWeekend(new Date(year, month - 1, day)))
            count++;
    }
    return count;
}
function getPerformanceCategory(pct) {
    if (pct >= 100)
        return "excellent";
    if (pct >= 80)
        return "good";
    if (pct >= 50)
        return "warning";
    return "critical";
}
//# sourceMappingURL=workingDays.js.map