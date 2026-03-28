const formatFromMinutesToHours = (minutes: number) => {
  const dividedByHour = Math.floor(minutes / 60);
  const remainderByHour = minutes % 60;
  if (dividedByHour) {
    return `${dividedByHour}시간 ${remainderByHour}분`;
  }

  return `${remainderByHour}분`;
};

export { formatFromMinutesToHours };
