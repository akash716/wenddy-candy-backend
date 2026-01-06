import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: "localhost",
  user: "root",          // change if needed
  password: "",          // change if needed
  database: "wenddy_candy",
  waitForConnections: true,
  connectionLimit: 10
});
