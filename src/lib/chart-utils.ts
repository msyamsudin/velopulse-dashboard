/**
 * Downsamples an array of data points to a maximum specified number of points.
 * This ensures charts remain readable and performant during long sessions.
 * 
 * @param data The array of data points to downsample.
 * @param maxPoints The maximum number of points to return.
 * @returns A downsampled version of the data.
 */
export const downsample = <T>(data: T[], maxPoints: number): T[] => {
  if (!data || data.length <= maxPoints) return data || [];
  
  const factor = data.length / maxPoints;
  const result: T[] = [];
  
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.floor(i * factor);
    result.push(data[index]);
  }
  
  // Always ensure the latest point is included to show current telemetry
  const lastPoint = data[data.length - 1];
  if (result[result.length - 1] !== lastPoint) {
    result[result.length - 1] = lastPoint;
  }
  
  return result;
};
