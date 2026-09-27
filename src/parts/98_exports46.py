# test hooks for the build ring (must run after the hub is injected)
rep("window.HOLDOR={", "window.HOLDOR_RING={openRing,closeRing,ringTap,ringFrame,state:()=>RING,upgradeTower,sellTower,sellValue,w2s,closeSheet,openSheet};\nwindow.HOLDOR={", 1, 'ring-exp')
rep("window.HOLDOR={", "window.HOLDOR_TUT={TS,tutEvent,tutNext,tutAdvance,skipTutorial,LESSONS,TUT_STEPS,lessonStart,lessonsInit,learnMap,coachStart,coachStep,coachNext,coachEnd,COACH,startTour,hubLessons,migrate47,startTutorial,tutWantBase};\nwindow.HOLDOR={", 1, 'tut-exp')
