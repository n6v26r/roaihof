package main

import (
	"fmt"
	"os"

	"roaihof/internal/generator"
)

func main() {
	if err := generator.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "roaihof-data: %v\n", err)
		os.Exit(1)
	}
}
