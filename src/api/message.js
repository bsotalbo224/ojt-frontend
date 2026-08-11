import api from "./axios";

export const getConversations = () => api.get("/messages/conversations");