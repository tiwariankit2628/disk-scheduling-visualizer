# disk-scheduling-visualizer
Interactive Disk Scheduling Visualizer (FCFS, SSTF, SCAN, C-SCAN) with real-time graph and performance comparison.

Live Demo
👉 https://tiwariankit2628.github.io/disk-scheduling-visualizer/

Features
-Visualizes disk head movement step-by-step
-Supports multiple algorithms:
-FCFS (First Come First Serve)
-SSTF (Shortest Seek Time First)
-SCAN (Elevator Algorithm)
-C-SCAN (Circular SCAN)

Graph-based visualization using Chart.js

Displays:
*Seek Sequence
*Total Seek Time
*Number of Movements
*Comparison of all algorithms
*Best algorithm detection

Algorithms Overview
🔹 FCFS
Processes requests in the order they arrive. Simple but inefficient.

🔹 SSTF
Selects the nearest request. Minimizes seek time but may cause starvation.

🔹 SCAN
Moves in one direction and reverses at the end (like an elevator).

🔹 C-SCAN
Moves in one direction and jumps back to start. Provides uniform waiting time.

Objective:
To understand and compare disk scheduling algorithms based on performance metrics like seek time and efficiency.
