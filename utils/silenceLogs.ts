import { LogBox } from "react-native";

const noop = () => undefined;

console.log = noop;
console.info = noop;
console.debug = noop;
console.warn = noop;

LogBox.ignoreAllLogs(true);
