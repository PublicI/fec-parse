#!/usr/bin/env ruby

require 'rubygems'
require 'fech'
require 'json'

class Parse

  def initialize
    @temp_dir = File.join('.','temp')
    @parsed_dir = File.join('.','ruby_parsed')
    Dir.mkdir(@parsed_dir) unless Dir.exist?(@parsed_dir)
  end

  def get_id (file_name)
    file_name.sub('.fec','')
  end

  def parse (file_name)
    id = get_id(file_name)

    if !File.exist?(@parsed_dir + '/' + id + '.json')

      filing = Fech::Filing.new(id,:download_dir => @temp_dir, :csv_parser => Fech::CsvDoctor)

      rows = []

      if filing.readable?
        file = File.open(@parsed_dir + '/' + id + '.json', 'a')

        first = true

        count = 0

        file.write "{\r\n  \"rows\": [  \r\n    "
        filing.each_row do |row|
          begin
            parsed_row = filing.parse_row?(row)
            if parsed_row

              if count != 0
                file.write ",\r\n    "
              end
              count += 1

              file.write JSON.pretty_generate(parsed_row,{
                  indent: '      '
                }).gsub('}','    }')
              # file.write parsed_row.to_json
            end
          rescue Fech::VersionError => e
            STDERR.puts e
          end
        end

        puts 'parsed ' + count.to_s + ' rows'

        file.write "\r\n  ]\r\n}\r\n"

        file.close()
      end
    else
      puts 'skipping ' + id + ' because parsed file exists'
    end
  end

  def iterate
    Dir.foreach(@temp_dir) do |file|
      if file.include?('.fec') && !file.include?('fech_')
        puts 'parsing ' + file
        parse(file)
      end
    end
  end

end

parse = Parse.new
list = parse.iterate()
