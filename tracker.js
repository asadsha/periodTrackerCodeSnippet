// this javascript file includes all you need to get period dates, ovulation dates and peak ovulation date of next 12 months.
// database : mongodb
// steps are explained briefly above each function in comments......

/* first u need to take information from client about her last period starting dates.....if client don't remember, u need to set default values..in our case
    we have set default values(incase user don't remember) {cycleDays=28},{periodDays=5},{lastPeriodStartingDate=today}  */
const addScheduleConstants = (req, res, next) => {
  const {
    cycleDays,
    lastPeriodStartDay,
    lastPeriodStartMonth,
    lastPeriodStartYear,
    periodDays,
    age,
  } = req.body;

  const trackerData = new Model.PeriodTrackerModel({
    cycleDays,
    lastPeriodStartDay,
    lastPeriodStartMonth,
    lastPeriodStartYear,
    periodDays,
    age,
    userId: req.user._id, // getting client's id from token
  });
  trackerData
    .save()
    .then((savedEvent) => {
      res.status(200).send({
        savedEvent,
        Message: "Schedule Saved Successfully",
        type: status.Ok,
      });
    })
    .catch((err) => {
      res.status(500).send({
        Message: `Internal Server Error! Can't process your request right now...${err} `,
      });
    });
};

/* client can update her period dates, cycle days, etc anytime and will get updated schedule in response */
const editScheduleConstants = (req, res, next) => {
  // id of schedule input doc in db
  const { id } = req.params;
  const query = { $set: req.body.updatedDataObject };
  Model.PeriodTrackerModel.findByIdAndUpdate(
    id,
    query,
    { new: true },
    (err, result) => {
      if (err) {
        res.status(500).send({
          Message: `Internal Server Error! Can't process your request right now...${err} `,
        });
      } else {
        schedulerFormula.trackerEvaluationByLastPeriodDate(
          result,
          req,
          res,
          next
        );
      }
    }
  );
};

/* Here we will get schedule...... first we are getting user's period schedule input from db and then making a schedule by 
  calling last function in this js class named (...trackerEvaluationByLastPeriodDate...) for client's next 
  12 months including{.......period dates, ovulation dates, peakOvulationDate......} */
const getSchedule = (req, res, next) => {
  Model.PeriodTrackerModel.findOne({ userId: req.user._id })
    .then((scheduleConstants) => {
      if (scheduleConstants) {
        console.log(scheduleConstants);
        schedulerFormula.trackerEvaluationByLastPeriodDate(
          scheduleConstants,
          req,
          res,
          next
        );
      } else {
        res.status(400).send({
          Message: "Bad Request",
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        Message: `Internal Server Error! Can't process your request right now...${err} `,
      });
    });
};

/* you will be confused why another function for edit client's schedule input.....well this one is for auto updating client's 
   lastPeriodDates (...because after each period cycle, info about client's lastPeriodDate should be updated in db ...)*/
const editScheduleConstantsAuto = (req, res, next, newDate, id) => {
  const query = { $set: newDate };
  Model.PeriodTrackerModel.findByIdAndUpdate(
    id,
    query,
    { new: true },
    (err, result) => {
      if (err) {
        res.status(500).send({
          Message: `Internal Server Error! Can't process your request right now...${err} `,
        });
      } else {
        console.log(result);
        schedulerFormula.trackerEvaluationByLastPeriodDate(
          result,
          req,
          res,
          next
        );
      }
    }
  );
};

/* well here is the main function where i'm making a formula for calculating client's next 12 months cycle..*/
// ******************************** Brief steps of what i'm doing in this func *******************************
/*
   1- First i'm setting up all starting values, variables etc............. 
   2- Then for loop for 12 months ............ 
   3- Calculating total days of each month ........
   4- Then calculating client's period dates for each month and pushing in array named "Schedule"
      ************FORMAT OF SCHEDULE ARRAY IS EXPLAINED WHEN PUSHING VALUES IN IT*************** 
   5- Then mapping schedule array and by using schedule attributes of schedule array, we are getting dates **string date format..."DD-MM-YYYY"...**(... ya all can 
      edit this portion and convert dates from schedule in whatever format u like ...) and pushing period dates in array 
      named {..period..} and ovulation dates in array named {..fertility..} and peak ovulation dates in array named {..peakOvulationn..}
   6- period array, fertility array both includes 12,12 arrays......means each array for each cycle's  period and fertility days.......
      *******************************************************************************************************************************
      *********************period[0],fertility[0],peakOvulationn[0] includes dates for client's first cycle's period, ovulation, peakovulation dates****************   
      ******************************************************************************************************************************** 
   7- At the end we are updating client's info about last Period Dates in db.......by calling above function named {...editScheduleConstantsAuto...}    
*/
const trackerEvaluationByLastPeriodDate = (
  scheduleConstants,
  req,
  res,
  next
) => {
  try {
    const period = [];
    const fertility = [];
    const peakOvulationn = [];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    // let currentYear = 2020; // will be provided with req.body
    let currentYear = scheduleConstants.lastPeriodStartYear;
    // const lastPeriodStartDate = 5; // will be get from db
    const lastPeriodStartDate = scheduleConstants.lastPeriodStartDay;
    // let currentMonth = 4; // will be provided with req.body
    let currentMonth = scheduleConstants.lastPeriodStartMonth;
    let nextMonth = 0;
    const schedule = [];
    // const cycleDays = 28; // will be get from db
    const cycleDays = scheduleConstants.cycleDays;
    let cycleDaysOfCurrentMonth = 0;
    let periodStartDate = 0;
    let peakOvulationDate = 0;
    let lastCycleDays = 0; // days of a cycle left for next month
    let nextCycleDays = 0; // days of a next cycle in a current month
    let nextMonthYear = 0;
    let nextPeriodStartDate = 0;
    let lastPeriodHandler = 0;
    // loop
    for (let i = 1; i <= 12; i++) {
      // getting total days of month
      const totalDaysOfMonth = new Date(
        currentYear,
        currentMonth + 1,
        0
      ).getDate();
      // getting next month {current month is 11{decmber} then next month will be 0{january}
      nextMonth = (currentMonth + 1) % 12;
      const totalDaysOfNextMonth = new Date(
        currentYear,
        nextMonth + 1,
        0
      ).getDate();
      // checking if the month is 11 then we are gpnna need next Year somewhere bcz next month maybe the month of next year means january
      if (currentMonth == 11) {
        nextMonthYear = currentYear + 1;
      } else {
        nextMonthYear = currentYear;
      }
      // means if days of this month are greater than the last cycleDays left for this month.
      if (totalDaysOfMonth > lastCycleDays) {
        // if i is equal to 1 means this is the first iteration and we need to make periodStartDate entered by user
        if (i === 1) {
          console.log("i===1");
          periodStartDate = lastPeriodStartDate;
          // caluclating the days of thi month avaialble for cycle after subtracting the days passed before user's period start date
          cycleDaysOfCurrentMonth = totalDaysOfMonth - lastPeriodStartDate + 1;
          // its just for some conditional stuff u will see
          lastPeriodHandler = lastPeriodStartDate + 1;
        } else {
          // this is not first iteration and periodStart date is gonna be predicted by the ending of last/previous cycle
          periodStartDate = lastCycleDays + 1;
          // caluclating the days of thi month avaialble for cycle after subtracting the days of the previous cycle
          cycleDaysOfCurrentMonth = totalDaysOfMonth - lastCycleDays;
          lastPeriodHandler = 0;
        }

        if (cycleDaysOfCurrentMonth > cycleDays) {
          // caluclating the days of the month avaialble for next cycle after the current cycle
          nextCycleDays = cycleDaysOfCurrentMonth - cycleDays;
          // scenario of setting first period in any month
          schedule.push({
            // eslint-disable-next-line object-shorthand
            periodStartDate: {
              date: periodStartDate,
              monthh: currentMonth,
              month: monthNames[currentMonth],
              totalDays: totalDaysOfMonth,
              year: currentYear,
            },
            peakOvulationDate: {
              date: totalDaysOfMonth - nextCycleDays - 14,
              month: monthNames[currentMonth],
              monthh: currentMonth,
              totalDays: totalDaysOfMonth,
              year: currentYear,
            },
            ovulationStartDate: {
              date: totalDaysOfMonth - nextCycleDays - 20,
              month: monthNames[currentMonth],
              monthh: currentMonth,
              totalDays: totalDaysOfMonth,
              year: currentYear,
            },
          });
          // second scenario for double period start dates in single month
          nextPeriodStartDate = periodStartDate + cycleDays;
          // calculatin the cycle days of current cycle left for next month so we can get the ovulation dates
          lastCycleDays = cycleDays - nextCycleDays;
          if (lastCycleDays > 20) {
            schedule.push({
              periodStartDate: {
                date: nextPeriodStartDate,
                monthh: currentMonth,
                month: monthNames[currentMonth],
                totalDays: totalDaysOfMonth,
                year: currentYear,
              },
              peakOvulationDate: {
                date: lastCycleDays - 14,
                monthh: nextMonth,
                month: monthNames[nextMonth],
                totalDays: totalDaysOfNextMonth,
                year: nextMonthYear,
              },
              ovulationStartDate: {
                date: lastCycleDays - 20,
                month: monthNames[nextMonth],
                monthh: nextMonth,
                totalDays: totalDaysOfNextMonth,
                year: nextMonthYear,
              },
            });
          } else {
            if (lastCycleDays > 14) {
              peakOvulationDate = lastCycleDays - 14;
              const extendedDaysOfLastCycleDays = peakOvulationDate;
              schedule.push({
                periodStartDate: {
                  date: nextPeriodStartDate,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                peakOvulationDate: {
                  date: lastCycleDays - 14,
                  month: monthNames[nextMonth],
                  monthh: nextMonth,
                  totalDays: totalDaysOfNextMonth,
                  year: nextMonthYear,
                },
                ovulationStartDate: {
                  date: totalDaysOfMonth - 6 + extendedDaysOfLastCycleDays,
                  monthh: currentMonth,
                  month: monthNames[currentMonth],
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
              });
            } else {
              schedule.push({
                periodStartDate: {
                  date: nextPeriodStartDate,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                peakOvulationDate: {
                  date: totalDaysOfMonth - 14 + lastCycleDays,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                ovulationStartDate: {
                  date: totalDaysOfMonth - 20 + lastCycleDays,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
              });
            }
          }
        } else {
          // calculatin the cycle days of current cycle left for next month so we can get the ovulation dates
          lastCycleDays = cycleDays - cycleDaysOfCurrentMonth;
          // one scenario of setting schedule
          if (lastCycleDays > 20) {
            schedule.push({
              periodStartDate: {
                date: periodStartDate,
                month: monthNames[currentMonth],
                monthh: currentMonth,
                totalDays: totalDaysOfMonth,
                year: currentYear,
              },
              peakOvulationDate: {
                date: lastCycleDays - 14,
                month: monthNames[nextMonth],
                monthh: nextMonth,
                totalDays: totalDaysOfNextMonth,
                year: nextMonthYear,
              },
              ovulationStartDate: {
                date: lastCycleDays - 20,
                month: monthNames[nextMonth],
                monthh: nextMonth,
                totalDays: totalDaysOfNextMonth,
                year: nextMonthYear,
              },
            });
          } else {
            if (lastCycleDays > 14) {
              peakOvulationDate = lastCycleDays - 14;
              const extendedDaysOfLastCycleDays = peakOvulationDate;
              schedule.push({
                periodStartDate: {
                  date: periodStartDate,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                peakOvulationDate: {
                  date: lastCycleDays - 14,
                  month: monthNames[nextMonth],
                  monthh: nextMonth,
                  totalDays: totalDaysOfNextMonth,
                  year: nextMonthYear,
                },
                ovulationStartDate: {
                  date: totalDaysOfMonth - 6 + extendedDaysOfLastCycleDays,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
              });
            } else {
              schedule.push({
                periodStartDate: {
                  date: periodStartDate,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                peakOvulationDate: {
                  date: totalDaysOfMonth - 14 + lastCycleDays,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
                ovulationStartDate: {
                  date: totalDaysOfMonth - 20 + lastCycleDays,
                  month: monthNames[currentMonth],
                  monthh: currentMonth,
                  totalDays: totalDaysOfMonth,
                  year: currentYear,
                },
              });
            }
          }
        }
        if (currentMonth == 11) {
          // As we entering into new year so we are incrementing it here
          currentYear += 1;
        }
        // incrementing month
        currentMonth = nextMonth;
      }
    }
    // .....making logic for setting all the dates in this format([15-06-2020])..........
    if (schedule.length > 0) {
      schedule.map((el, index) => {
        const periodDates = [];
        const fertilityDates = [];
        if (scheduleConstants.periodDays > 0) {
          // for period first iteration

          let nextDay = el.periodStartDate.date;
          // for transforming date in two digits format
          const twoDigitNextDay = nextDay >= 10 ? nextDay : "0" + nextDay;

          let nextMonthh = el.periodStartDate.monthh;

          // for transforming month in two digits format
          const twoDigitNextMonth =
            nextMonthh + 1 >= 10 ? nextMonthh + 1 : `0${nextMonthh + 1}`;
          let nextYear = el.periodStartDate.year;
          periodDates.push(
            twoDigitNextDay + "-" + twoDigitNextMonth + "-" + nextYear
          );

          // for for getting period dates in array
          for (let i = 1; i <= scheduleConstants.periodDays; i++) {
            // nextDay is 32 then we will move it to 1 of next month
            if (i == 1) {
              // console.log('index 1');
            } else {
              nextDay = (nextDay + 1) % (el.periodStartDate.totalDays + 1);
              if (nextDay == 0) {
                nextDay = 1;
              }
              if (nextDay == 1) {
                nextMonthh = (nextMonthh + 1) % 12;
              }
              if (nextMonthh == 0) {
                if (nextDay == 1) {
                  nextYear = el.periodStartDate.year + 1;
                }
              }
              // for transforming date in two digits format
              const twoDigitNextDayy = nextDay >= 10 ? nextDay : "0" + nextDay;
              // for transforming month in two digits format
              const twoDigitNextMonthh =
                nextMonthh + 1 >= 10 ? nextMonthh + 1 : `0${nextMonthh + 1}`;
              periodDates.push(
                twoDigitNextDayy + "-" + twoDigitNextMonthh + "-" + nextYear
              );
            }
          }
          period.push(periodDates);
        }
        // for for getting fertitlity dates in array
        // for fertility first iteration

        let fNextDay = el.ovulationStartDate.date;
        // for transforming date in two digits format
        const twoDigitFNextDay = fNextDay >= 10 ? fNextDay : "0" + fNextDay;
        let fNextMonthh = el.ovulationStartDate.monthh;
        // for transforming month in two digits format
        const twoDigitFNextMonth =
          fNextMonthh + 1 >= 10 ? fNextMonthh + 1 : "0" + (fNextMonthh + 1);
        let fNextYear = el.ovulationStartDate.year;
        fertilityDates.push(
          twoDigitFNextDay + "-" + twoDigitFNextMonth + "-" + fNextYear
        );
        for (let i = 1; i <= 9; i++) {
          // nextDay is 32 then we will move it to 1 of next month
          if (i == 1) {
            // console.log('index 1');
          } else {
            fNextDay = (fNextDay + 1) % (el.ovulationStartDate.totalDays + 1);
            if (fNextDay == 0) {
              fNextDay = 1;
            }

            if (fNextDay == 1) {
              fNextMonthh = (fNextMonthh + 1) % 12;
            }

            if (fNextMonthh == 0) {
              if (fNextDay == 1) {
                fNextYear = el.ovulationStartDate.year + 1;
              }
            }
            const twoDigitFNextDayy =
              fNextDay >= 10 ? fNextDay : "0" + fNextDay;
            const twoDigitFNextMonthh =
              fNextMonthh + 1 >= 10 ? fNextMonthh + 1 : "0" + (fNextMonthh + 1);
            fertilityDates.push(
              twoDigitFNextDayy + "-" + twoDigitFNextMonthh + "-" + fNextYear
            );
          }
        }
        fertility.push(fertilityDates);
        // for peak Ovulation Date
        // making 2 digit format
        const twoDigitPNextDay =
          el.peakOvulationDate.date >= 10
            ? el.peakOvulationDate.date
            : "0" + el.peakOvulationDate.date;
        const twoDigitPNextMonth =
          el.peakOvulationDate.monthh + 1 >= 10
            ? el.peakOvulationDate.monthh + 1
            : "0" + (el.peakOvulationDate.monthh + 1);
        peakOvulationn.push(
          twoDigitPNextDay +
            "-" +
            twoDigitPNextMonth +
            "-" +
            el.peakOvulationDate.year
        );
      });
    }

    // for checking if user's next period started then we will update user's last period time
    let status = false;
    let newDate = {};
    const today = new Date().toISOString().slice(0, 10);
    if (period[1].length > 0) {
      period[1].map((el, index) => {
        if (index == 0) {
          if (status == false) {
            const splitDate = el.split("-");
            const reverseDate = `${splitDate[2]}-${splitDate[1]}-${splitDate[0]}`;
            if (today > reverseDate) {
              status = true;
              newDate = {
                lastPeriodStartYear: splitDate[2],
                lastPeriodStartMonth: splitDate[1] - 1,
                lastPeriodStartDay: splitDate[0],
              };
            }
          }
        }
      });
    }
    // status == true means we have updated user's schedule and we need to update through other route
    if (status === true) {
      periodTracker.editScheduleConstantsAuto(
        res,
        res,
        next,
        newDate,
        scheduleConstants._id
      );
    } else {
      res.status(200).send({
        period,
        fertility,
        peakOvulationn,
      });
    }
  } catch (error) {
    res.status(500).send({
      Message: `Internal Server Error! Can't process your request right now...${err} `,
    });
  }
};

export default {
  trackerEvaluationByLastPeriodDate,
  getSchedule,
  addScheduleConstants,
  editScheduleConstants,
  editScheduleConstantsAuto,
};
