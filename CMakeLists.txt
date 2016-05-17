cmake_minimum_required (VERSION 2.8)
project(git-stock)

SET(CMAKE_CXX_FLAGS "-std=c++0x -g -O0 ${CMAKE_CXX_FLAGS}")

add_executable(git-stock
	src/main.cc
	src/LineAgeMetrics.cc
	src/FileMetrics.cc
	src/TreeMetrics.cc
	src/util.cc
    src/Stock.cc
	src/Options.cc
    src/PlainTextReport.cc
    src/CommitTimeline.cc
)


target_include_directories(git-stock PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(git-stock git2 gmp gmpxx jsoncpp)

#set_property(TARGET git-stock PROPERTY CXX_STANDARD 11)
#set_property(TARGET git-stock PROPERTY CXX_STANDARD_REQUIRED ON)
