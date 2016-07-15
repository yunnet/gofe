package utils

import (
	"encoding/json"
	"fmt"
	"log"
)

// Utils (Dumps almost everything)
func Dump(cls interface{}) {
	data, err := json.MarshalIndent(cls, "", "    ")
	if err != nil {
		log.Println("[ERROR] Oh no! There was an error on Dump command: ", err)
		return
	}
	fmt.Println(string(data))
}
