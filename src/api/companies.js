import axios from "./axios";

export const getCompanies = async () => {
  const res = await axios.get("/companies");
  return res.data;
};