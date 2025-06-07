"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDuplicate = isDuplicate;
exports.markAsSent = markAsSent;
const SentRequests = new Set(); // set to track sent requests
function isDuplicate(requestid) {
    return SentRequests.has(requestid);
} // check for duplicates and return the status
function markAsSent(requestid) {
    SentRequests.add(requestid);
} // add for marking as sent
