import axios from "./axios";

export const getStudentReviews = async () => {
  const res = await axios.get("/reviews/student");
  return res.data;
};
