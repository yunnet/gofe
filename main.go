package main

import (
	"log"
	"os"
	"runtime"
	"runtime/debug"
)

func configRuntime() {
	if os.Getenv("GOGC") == "" {
		log.Printf("Setting default GOGC=%d", 800)
		debug.SetGCPercent(800)
	} else {
		log.Printf("Using GOGC=%s from env.", os.Getenv("GOGC"))
	}

	if os.Getenv("GOMAXPROCS") == "" {
		numCPU := runtime.NumCPU()
		log.Printf("Setting default GOMAXPROCS=%d.", numCPU)
		runtime.GOMAXPROCS(numCPU)
	} else {
		log.Printf("Using GOMAXPROCS=%s from env", os.Getenv("GOMAXPROCS"))
	}
}

func main() {
	configRuntime()
	Start()
}
